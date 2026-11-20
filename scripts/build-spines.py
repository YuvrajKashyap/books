"""Bake jacket-derived binding art. Run from the repo root with Pillow and Windows fonts."""
from pathlib import Path
from io import BytesIO
import hashlib
import json
import colorsys
import textwrap
from PIL import Image, ImageDraw, ImageFont

public = Path("frontend/public")
manifest = Path("frontend/src/shelf/jackets.json")
jackets = json.loads(manifest.read_text(encoding="utf-8"))
out = public / "bindings"
out.mkdir(exist_ok=True)
fonts = Path("C:/Windows/Fonts")
# Hand-set the display shelf and frequently read titles. Widths are visual.
directed = {
    "Shoe Dog": ("#c63b2d", "#fff4dc", "#291d19", "ARIALNBI", 29),
    "Atomic Habits": ("#f4ebd7", "#755321", "#b48b4b", "georgiab", 25),
    "A Brief History of Time": ("#102b3b", "#f4f0df", "#799fad", "ARIALNB", 22),
    "Meditations": ("#211f21", "#eeebe2", "#b12628", "georgia", 23),
    "Deep Work": ("#f2be25", "#252323", "#a53e30", "impact", 26),
    "The Daily Laws": ("#30316a", "#f2df96", "#eee6cf", "palab", 35),
    "100M Offers": ("#512279", "#fff5de", "#edbb42", "impact", 24),
    "The Millionaire Fastlane": ("#16223a", "#fff4d8", "#b79b55", "ARIALNBI", 34),
    "The Startup of You": ("#eeeae0", "#2d3439", "#4491a3", "bahnschrift", 22),
}

def luminance(rgb):
    vals = [(x / 255 / 12.92 if x < 11 else ((x / 255 + .055) / 1.055) ** 2.4) for x in rgb]
    return sum(v * w for v, w in zip(vals, (.2126, .7152, .0722)))

def palette(image):
    reduced = image.resize((70, 100)).quantize(10).convert("RGB")
    colors = [color for count, color in sorted(reduced.getcolors(), reverse=True)]
    base = colors[0]
    l = luminance(base)
    contrast = lambda c: (max(l, luminance(c)) + .05) / (min(l, luminance(c)) + .05)
    ink = next((c for c in colors[1:] if contrast(c) >= 4.5), max([(252,249,240),(21,18,16)],key=contrast))
    accent = max(colors, key=lambda c: colorsys.rgb_to_hsv(*[v/255 for v in c])[1] * min(contrast(c),4))
    return base, ink, accent

def fitted(text, font, size, max_width):
    while size > 11:
        f = ImageFont.truetype(str(fonts / (font + ".ttf")), size)
        if f.getlength(text) <= max_width: return f
        size -= 1
    return ImageFont.truetype(str(fonts / (font + ".ttf")), size)

for key, jacket in jackets.items():
    title, author = key.split("|", 1)
    cover = Image.open(public / jacket["file"][1:]).convert("RGB")
    seed = int(hashlib.sha256(jacket["file"].encode()).hexdigest()[:8],16)
    base, ink, accent = palette(cover)
    font = ("georgiab","ARIALNB","bahnschrift","palab","impact","georgiai")[seed % 6]
    depth = 20 + seed % 16
    if title in directed: base, ink, accent, font, depth = directed[title]
    h, w = depth * 4, 684
    art = Image.new("RGB",(w,h),base)
    draw = ImageDraw.Draw(art)
    # A narrow fragment of the actual jacket becomes the printed tailcap.
    cap = 24 + seed % 23
    strip = cover.crop((0,int(cover.height*.28),cover.width,int(cover.height*.48))).resize((cap,h))
    art.paste(strip,(w-cap,0))
    draw.rectangle((w-cap-5,0,w-cap-1,h),fill=accent)
    if seed % 3 == 0:
        draw.rectangle((0,0,9,h),fill=accent)
    elif seed % 3 == 1:
        draw.line((18,10,w-cap-18,10),fill=accent,width=2)
    label = title.upper() if font in ("impact","ARIALNB","ARIALNBI") else title
    lines = textwrap.wrap(label, width=36,break_long_words=False) if len(label)>42 else [label]
    text = "\n".join(lines)
    fs = min(68, int(h*.54)) if len(lines)==1 else min(38,int(h*.34))
    f = fitted(max(lines,key=len), font, fs, w-cap-40)
    draw.multiline_text((20,h*.39),text,fill=ink,font=f,anchor="lm",spacing=0)
    by = author.upper()
    draw.text((22,h*.83),by,fill=ink,font=fitted(by,"ARIALNB",min(21,int(h*.20)),w-cap-48),anchor="lm")
    data = BytesIO()
    art.transpose(Image.Transpose.ROTATE_270).save(data,"WEBP",quality=94,method=6)
    raw = data.getvalue()
    filename = hashlib.sha256(raw).hexdigest()[:16]+".webp"
    (out/filename).write_bytes(raw)
    jacket.update(spine="/bindings/"+filename, depth=depth)
manifest.write_text(json.dumps(jackets,indent=2,sort_keys=True),encoding="utf-8")
