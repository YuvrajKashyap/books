import { createClient } from "@supabase/supabase-js";
import type { Context } from "hono";
import { z } from "zod";

type LoginConfig = { email: string; ownerId: string; url: string; key: string };

export async function ownerLogin(c: Context, config: LoginConfig) {
  const { username, password } = z.object({
    username: z.string().trim().max(120),
    password: z.string().min(1).max(1024),
  }).parse(await c.req.json());
  const invalid = () => c.json({ error: "Could not sign in with those details." }, 401);
  if (username.toLowerCase() !== "yuvraj") return invalid();
  if (!config.email || !config.ownerId) return c.json({ error: "Sign-in is unavailable." }, 503);
  const client = createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email: config.email, password });
  if (error?.status === 429) return c.json({ error: "Too many attempts." }, 429);
  if (error && (!error.status || error.status >= 500)) return c.json({ error: "Sign-in is unavailable." }, 503);
  if (error || !data.session || data.user?.id !== config.ownerId) return invalid();
  const { access_token, refresh_token } = data.session;
  return c.json({ access_token, refresh_token });
}
