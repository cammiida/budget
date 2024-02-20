import "@remix-run/cloudflare";
import type { z } from "zod";
import { envSchema } from "~env.server";

declare module "@remix-run/cloudflare" {
  interface AppLoadContext {
    waitUntil: EventContext<unknown, unknown, unknown>["waitUntil"];
    env: z.infer<typeof envSchema>;
    db: D1Database;
  }
}
