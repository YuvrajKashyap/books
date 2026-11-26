// The WebGL half of the room: a starfield that lenses around a mass, and the
// fabric, a luminous grid that every book and the pointer dent. It shares one
// camera with the CSS 3D books, so a well sits exactly under its book.
import * as THREE from "three";
import type { Camera } from "./layout";

const MAX_RIPPLES = 8;

const starsVert = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 1.0, 1.0);
}
`;

const starsFrag = /* glsl */ `
precision highp float;
uniform vec2 uRes;      // css px
uniform float uDpr;
uniform float uTime;
uniform vec2 uLens;     // css px, origin bottom left
uniform float uTheta;   // Einstein radius in css px
uniform float uRing;
uniform float uStretch;
uniform vec2 uVanish;
uniform float uDim;
uniform sampler2D uNameTex;
uniform vec4 uName;     // x, y, w, h in css px, origin bottom left
uniform float uNameOn;

float nameAt(vec2 s) {
  vec2 uv = (s - uName.xy) / uName.zw;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  return texture2D(uNameTex, uv).a;
}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1, 0)), f.x),
             mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x), f.y);
}
vec3 layer(vec2 p, float cell, float seed) {
  vec2 g = p / cell;
  vec2 id = floor(g);
  vec2 f = fract(g);
  float h = hash21(id + seed);
  if (h < 0.6) return vec3(0.0);
  vec2 c = vec2(hash21(id + seed + 7.1), hash21(id + seed + 13.7)) * 0.5 + 0.25;
  vec2 d = (f - c) * cell;
  vec2 u = normalize((id + c) * cell - uVanish + vec2(0.001));
  float al = dot(d, u);
  float pe = length(d - al * u);
  float dd = length(vec2(al / (1.0 + uStretch), pe));
  float b = pow(hash21(id + seed + 3.3), 5.0);
  float rad = 0.75 + b * 1.7;
  float tw = 0.82 + 0.18 * sin(uTime * (0.6 + h * 2.4) + h * 40.0);
  float s = smoothstep(rad, 0.0, dd) * (0.28 + b * 1.25) * tw / (1.0 + uStretch * 0.1);
  s += b * b * 0.3 * exp(-dd * dd / (rad * rad * 16.0));
  vec3 tint = mix(vec3(0.72, 0.82, 1.0), vec3(1.0, 0.85, 0.66),
                  step(0.92, hash21(id + seed + 21.0)));
  return tint * s;
}
void main() {
  vec2 p = gl_FragCoord.xy / uDpr;
  vec2 src = p;
  float shade = 1.0;
  vec3 col = vec3(0.0);
#ifdef LENS
  vec2 d = p - uLens;
  float r = max(length(d), 0.5);
  vec2 bend = vec2(0.0);
  if (uTheta > 0.5) {
    // Point mass lens: a ray seen at r came from r - theta^2 / r.
    bend = d * (uTheta * uTheta / (r * r));
    src = p - bend;
    shade = smoothstep(0.18 * uTheta, 0.75 * uTheta, r);
    float w = uTheta * 0.045 + 1.2;
    float dr = (r - uTheta) / w;
    float ring = exp(-dr * dr);
    float halo = exp(-dr * dr / 25.0);
    col += vec3(0.7, 0.81, 1.0) * (ring * 0.62 + halo * 0.12) * uRing;
  }
#endif
  col += layer(src, 58.0, 1.0) * shade;
  col += layer(src + 311.0, 104.0, 5.0) * shade * 1.15;
#ifdef LENS
  col += layer(src + 97.0, 176.0, 9.0) * shade * 1.5;
  float bd = (src.y - uRes.y * 0.66 - (src.x - uRes.x * 0.5) * 0.2) / (uRes.y * 0.3);
  float band = exp(-bd * bd);
  float n = vnoise(src * 0.0028) * 0.62 + vnoise(src * 0.0071 + 9.0) * 0.38;
  col += vec3(0.07, 0.115, 0.23) * n * n * band * shade * 0.95;
  // The name is part of the sky, so the same mass bends it, and splits its
  // light a little the way a lens does.
  if (uNameOn > 0.001) {
    vec3 ink = vec3(nameAt(p - bend * 0.93), nameAt(p - bend), nameAt(p - bend * 1.08));
    float cover = max(ink.r, max(ink.g, ink.b)) * uNameOn;
    col = col * (1.0 - cover) + ink * vec3(0.957, 0.969, 1.0) * uNameOn * mix(0.35, 1.0, shade);
  }
#endif
  gl_FragColor = vec4(col * uDim, 1.0);
}
`;

const fabricVert = (wells: number) => /* glsl */ `
#define NW ${wells}
#define NR ${MAX_RIPPLES}
uniform mat4 uWorld;
uniform vec4 uWells[NW];   // x, z, depth, radius
uniform int uWellCount;
uniform vec4 uRipples[NR]; // x, z, start time, amplitude
uniform float uTime;
uniform vec4 uPointer;
uniform vec4 uReader;
uniform float uEyeZ;
varying vec2 vOrig;
varying float vDip;
varying float vWave;
varying float vWarm;

void sink(vec2 o, vec4 w, inout float dip, inout vec2 pull) {
  vec2 d = o - w.xy;
  float q = 1.0 / (1.0 + dot(d, d) / (w.w * w.w));
  float q2 = q * q;
  dip += w.z * q2;
  pull -= d * (0.26 * clamp(w.z / 150.0, 0.0, 1.3)) * q2;
}

void main() {
  vec2 o = vec2(position.x, position.z + uEyeZ);
  float dip = 0.0;
  vec2 pull = vec2(0.0);
  for (int i = 0; i < NW; i++) {
    if (i >= uWellCount) break;
    sink(o, uWells[i], dip, pull);
  }
  sink(o, uPointer, dip, pull);
  sink(o, uReader, dip, pull);

  float wave = 0.0;
  float lift = 0.0;
  for (int i = 0; i < NR; i++) {
    vec4 rp = uRipples[i];
    float age = uTime - rp.z;
    if (rp.w <= 0.0 || age < 0.0 || age > 7.0) continue;
    float r = length(o - rp.xy);
    float x = r - age * 860.0;
    float env = exp(-x * x / (2.0 * 150.0 * 150.0));
    float fade = exp(-age * 0.5) * smoothstep(0.0, 0.12, age) / (1.0 + r / 1700.0);
    lift += rp.w * sin(x * 0.03) * env * fade;
    wave += env * fade * rp.w / 46.0;
  }

  vOrig = o;
  vDip = dip;
  vWave = wave;
  vec2 pd = o - uPointer.xy;
  vWarm = exp(-dot(pd, pd) / (uPointer.w * uPointer.w * 2.2)) * clamp(uPointer.z / 60.0, 0.0, 1.0);
  vec4 wp = uWorld * vec4(o.x + pull.x, dip - lift, o.y + pull.y, 1.0);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const fabricFrag = /* glsl */ `
precision highp float;
uniform float uCell;
uniform vec3 uCold;
uniform vec3 uWarm;
uniform float uReveal;
uniform float uSpark;
uniform vec2 uOrigin;
uniform float uEyeZ;
uniform float uDim;
varying vec2 vOrig;
varying float vDip;
varying float vWave;
varying float vWarm;

float gridLine(vec2 g, float width) {
  vec2 fw = max(fwidth(g), vec2(0.0001));
  vec2 a = abs(fract(g - 0.5) - 0.5) / fw;
  float l = 1.0 - min(min(a.x, a.y) / width, 1.0);
  return l * (1.0 - smoothstep(0.22, 0.75, max(fw.x, fw.y)));
}

void main() {
  float minor = gridLine(vOrig / uCell, 1.15);
  float major = gridLine(vOrig / (uCell * 4.0), 1.7);
  float dist = max(uEyeZ - vOrig.y, 0.0);
  float fog = exp(-dist / 2900.0) * (1.0 - smoothstep(2400.0, 4500.0, abs(vOrig.x)));
  float glow = clamp(vDip / 120.0, 0.0, 1.8);
  float a = (minor * 0.4 + major * 0.58) * (0.56 + glow * 1.7) + glow * 0.05;
  a += vWave * (minor * 0.9 + major * 0.6 + 0.07) * 1.5;

  float rd = length(vOrig - uOrigin);
  float R = uReveal * 5600.0;
  float mask = 1.0 - smoothstep(R - 80.0, R, rd);
  float fr = (rd - R) / 110.0;
  float front = exp(-fr * fr) * (1.0 - smoothstep(0.7, 1.0, uReveal)) * step(0.001, uReveal);
  a = a * mask + front * (0.25 + minor + major) * 0.9;

  float spark = (exp(-rd * rd / 2600.0) * 2.2 + exp(-rd * rd / 60000.0) * 0.4) * uSpark;
  vec3 tint = mix(uCold, uWarm, clamp(vWarm, 0.0, 1.0) * 0.9);
  vec3 col = tint * a * fog + mix(uCold, vec3(1.0), 0.5) * spark;
  gl_FragColor = vec4(col * uDim, 1.0);
}
`;

export type Frame = {
  time: number;
  cam: Camera;
  pointer: { x: number; z: number; depth: number; sigma: number };
  reader: { x: number; z: number; depth: number; sigma: number };
  lens: { x: number; y: number; theta: number; ring: number }; // css px from top left
  stretch: number;
  reveal: number;
  spark: number;
  origin: { x: number; z: number };
  name: { x: number; y: number; w: number; h: number; on: number }; // css px from top left
};

export class Fabric {
  readonly maxWells: number;
  readonly wells: Float32Array;
  wellCount = 0;

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(50, 1, 20, 40000);
  private stars: THREE.ShaderMaterial;
  private fabric: THREE.ShaderMaterial;
  private geos: THREE.BufferGeometry[] = [];
  private ripples = new Float32Array(MAX_RIPPLES * 4);
  private rippleAt = 0;
  private world = new THREE.Matrix4();
  private scratch = new THREE.Matrix4();
  private w = 1;
  private h = 1;
  private dpr = 1;
  private clock = 0;
  private nameTex: THREE.CanvasTexture | null = null;
  private originY = 0;

  constructor(canvas: HTMLCanvasElement, lite: boolean) {
    this.maxWells = lite ? 28 : 72;
    this.wells = new Float32Array(this.maxWells * 4);
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !lite,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x05070c, 1);
    this.dpr = Math.min(window.devicePixelRatio || 1, lite ? 1.5 : 2);
    this.renderer.setPixelRatio(this.dpr);

    this.stars = new THREE.ShaderMaterial({
      vertexShader: starsVert,
      fragmentShader: starsFrag,
      defines: lite ? {} : { LENS: 1 },
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uRes: { value: new THREE.Vector2(1, 1) },
        uDpr: { value: this.dpr },
        uTime: { value: 0 },
        uLens: { value: new THREE.Vector2(0, 0) },
        uTheta: { value: 0 },
        uRing: { value: 0 },
        uStretch: { value: 0 },
        uVanish: { value: new THREE.Vector2(0, 0) },
        uDim: { value: 1 },
        uNameTex: { value: null },
        uName: { value: new THREE.Vector4(0, 0, 1, 1) },
        uNameOn: { value: 0 },
      },
    });
    const quad = new THREE.BufferGeometry();
    quad.setAttribute(
      "position",
      new THREE.BufferAttribute(
        new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]),
        3,
      ),
    );
    this.geos.push(quad);
    const sky = new THREE.Mesh(quad, this.stars);
    sky.frustumCulled = false;
    sky.renderOrder = 0;
    this.scene.add(sky);

    // The sheet: denser where the books are, coarser toward the edges.
    const nx = lite ? 110 : 230;
    const nz = lite ? 100 : 210;
    const pos = new Float32Array((nx + 1) * (nz + 1) * 3);
    let k = 0;
    for (let j = 0; j <= nz; j++) {
      const t = j / nz;
      const z = 700 - 7200 * Math.pow(t, 1.55);
      for (let i = 0; i <= nx; i++) {
        const u = (i / nx) * 2 - 1;
        pos[k++] = Math.sign(u) * Math.pow(Math.abs(u), 1.6) * 4700;
        pos[k++] = 0;
        pos[k++] = z;
      }
    }
    const idx = new Uint32Array(nx * nz * 6);
    k = 0;
    for (let j = 0; j < nz; j++)
      for (let i = 0; i < nx; i++) {
        const a = j * (nx + 1) + i;
        const b = a + 1;
        const c = a + nx + 1;
        const d = c + 1;
        idx[k++] = a;
        idx[k++] = c;
        idx[k++] = b;
        idx[k++] = b;
        idx[k++] = c;
        idx[k++] = d;
      }
    const sheet = new THREE.BufferGeometry();
    sheet.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    sheet.setIndex(new THREE.BufferAttribute(idx, 1));
    this.geos.push(sheet);

    this.fabric = new THREE.ShaderMaterial({
      vertexShader: fabricVert(this.maxWells),
      fragmentShader: fabricFrag,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uWorld: { value: this.world },
        uWells: { value: this.wells },
        uWellCount: { value: 0 },
        uRipples: { value: this.ripples },
        uTime: { value: 0 },
        uPointer: { value: new THREE.Vector4(0, 0, 0, 100) },
        uReader: { value: new THREE.Vector4(0, 0, 0, 100) },
        uEyeZ: { value: 0 },
        uCell: { value: lite ? 80 : 64 },
        uCold: { value: new THREE.Color(0.62, 0.76, 1.0) },
        uWarm: { value: new THREE.Color(1.0, 0.68, 0.34) },
        uReveal: { value: 0 },
        uSpark: { value: 1 },
        uOrigin: { value: new THREE.Vector2(0, 0) },
        uDim: { value: 1 },
      },
    });
    const mesh = new THREE.Mesh(sheet, this.fabric);
    mesh.frustumCulled = false;
    mesh.renderOrder = 1;
    this.scene.add(mesh);
  }

  resize(w: number, h: number, P: number, originY: number) {
    this.w = w;
    this.h = h;
    this.renderer.setSize(w, h, false);
    this.camera.fov = (Math.atan(h / 2 / P) * 360) / Math.PI;
    this.camera.aspect = w / h;
    this.camera.position.set(0, 0, P);
    (this.stars.uniforms.uRes.value as THREE.Vector2).set(w, h);
    this.setOrigin(originY);
  }

  // Where the camera's principal point sits, in px from the top.
  setOrigin(originY: number) {
    this.originY = originY;
    this.camera.setViewOffset(
      this.w,
      this.h,
      0,
      this.h / 2 - originY,
      this.w,
      this.h,
    );
    this.camera.updateProjectionMatrix();
  }

  // The name, drawn once on a 2D canvas, becomes a texture in the sky.
  setName(canvas: HTMLCanvasElement | null) {
    this.nameTex?.dispose();
    this.nameTex = null;
    if (canvas) {
      const tex = new THREE.CanvasTexture(canvas);
      tex.generateMipmaps = false;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      this.nameTex = tex;
    }
    this.stars.uniforms.uNameTex.value = this.nameTex;
  }
  get hasName() {
    return this.nameTex !== null;
  }

  ripple(x: number, z: number, amp: number) {
    const i = this.rippleAt * 4;
    this.ripples[i] = x;
    this.ripples[i + 1] = z;
    this.ripples[i + 2] = this.clock;
    this.ripples[i + 3] = amp;
    this.rippleAt = (this.rippleAt + 1) % MAX_RIPPLES;
  }

  render(f: Frame) {
    this.clock = f.time;
    const { cam } = f;
    // The same matrix the CSS world wears, then flipped into y-up.
    this.world
      .makeScale(1, -1, 1)
      .multiply(this.scratch.makeTranslation(0, 0, cam.P))
      .multiply(this.scratch.makeRotationX(-cam.pitch))
      .multiply(this.scratch.makeTranslation(0, cam.eyeH, -cam.ez));

    const fu = this.fabric.uniforms;
    fu.uWellCount.value = this.wellCount;
    fu.uTime.value = f.time;
    (fu.uPointer.value as THREE.Vector4).set(
      f.pointer.x,
      f.pointer.z,
      f.pointer.depth,
      f.pointer.sigma,
    );
    (fu.uReader.value as THREE.Vector4).set(
      f.reader.x,
      f.reader.z,
      f.reader.depth,
      f.reader.sigma,
    );
    fu.uEyeZ.value = cam.ez;
    fu.uReveal.value = f.reveal;
    fu.uSpark.value = f.spark;
    (fu.uOrigin.value as THREE.Vector2).set(f.origin.x, f.origin.z);

    const su = this.stars.uniforms;
    su.uTime.value = f.time;
    (su.uLens.value as THREE.Vector2).set(f.lens.x, this.h - f.lens.y);
    su.uTheta.value = f.lens.theta;
    su.uRing.value = f.lens.ring;
    su.uStretch.value = f.stretch;
    (su.uName.value as THREE.Vector4).set(
      f.name.x,
      this.h - (f.name.y + f.name.h),
      Math.max(1, f.name.w),
      Math.max(1, f.name.h),
    );
    su.uNameOn.value = this.nameTex ? f.name.on : 0;
    (su.uVanish.value as THREE.Vector2).set(
      this.w / 2,
      this.h - (this.originY - cam.P * Math.tan(cam.pitch)),
    );
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.nameTex?.dispose();
    for (const g of this.geos) g.dispose();
    this.stars.dispose();
    this.fabric.dispose();
    this.renderer.dispose();
  }
}
