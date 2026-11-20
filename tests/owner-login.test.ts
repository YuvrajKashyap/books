import assert from "node:assert/strict";
import test from "node:test";
import { Hono } from "hono";
import { ownerLogin } from "../backend/login.ts";

test("the username exchanges the owner's existing password for an owner-only session", async t => {
  const config = { email: "reader@example.test", ownerId: "owner-id", url: "https://auth.example.test", key: "test-key" };
  const app = new Hono().post("/login", c => ownerLogin(c, config));
  let returnedId = config.ownerId;
  const provider = t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.equal(String(url), config.url + "/auth/v1/token?grant_type=password");
    assert.deepEqual(JSON.parse(init.body), { email: config.email, password: "fixture", gotrue_meta_security: {} });
    return Response.json({ access_token: "test-access", refresh_token: "test-refresh", token_type: "bearer", expires_in: 3600, user: {id: returnedId} });
  });
  const login = (username: string) => app.request("/login", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password: "fixture" }),
  });
  assert.equal((await login("someone-else")).status, 401);
  assert.equal(provider.mock.callCount(), 0);
  const ok = await login(" Yuvraj ");
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), {access_token: "test-access", refresh_token: "test-refresh"});
  returnedId = "another-account";
  const rejected = await login("yuvraj");
  assert.equal(rejected.status, 401);
  assert.deepEqual(await rejected.json(), {error:"Could not sign in with those details."});
});
