import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve, relative, isAbsolute } from "node:path";
import { resolveConfig } from "vite";

test("the dev file server limits access to the browser app, shared types and dependencies", async () => {
  const config = await resolveConfig({}, "serve");
  const canServe = (file: string) => config.server.fs.allow.some(directory => {
    const path = relative(directory, resolve(file));
    return !path.startsWith("..") && !isAbsolute(path);
  });
  assert.ok(config.server.fs.strict);
  assert.ok(canServe("frontend/src/main.tsx"));
  assert.ok(canServe("shared/model.ts"));
  assert.ok(canServe("node_modules/react/index.js"));
  for (const directory of ["private", "backend", ".vercel", ".git"])
    assert.equal(canServe(directory + "/fixture.txt"), false, directory);
});

test("the public shelf preload remains covered by the production script policy", () => {
  const html = readFileSync("frontend/index.html", "utf8").replaceAll("\r\n", "\n");
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  const hosting = JSON.parse(readFileSync("vercel.json", "utf8"));
  const headers = hosting.headers.find((route: {source: string}) => route.source === "/(.*)").headers;
  const policy = headers.find((header: {key: string}) => header.key === "Content-Security-Policy").value;
  const scripts = policy.split(";").map((rule: string) => rule.trim()).find((rule: string) => rule.startsWith("script-src "));
  assert.equal(inline.length, 1);
  const jackets = JSON.parse(readFileSync("frontend/src/shared/jackets.json", "utf8"));
  assert.ok(inline[0][1].includes(JSON.stringify(jackets["Shoe Dog|Phil Knight"].spine)));

  const hash = createHash("sha256").update(inline[0][1]).digest("base64");
  assert.ok(scripts.split(" ").includes("'sha256-" + hash + "'"));
  assert.doesNotMatch(scripts, /unsafe-inline|unsafe-eval/);
});
