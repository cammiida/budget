import type {
  D1Database,
  EventContext,
  KVNamespace,
} from "@cloudflare/workers-types";
import type { z } from "zod";
import { envSchema } from "~env.server";

declare module "@remix-run/server-runtime" {
  interface AppLoadContext {
    waitUntil: EventContext<unknown, unknown, unknown>["waitUntil"];
    env: z.infer<typeof envSchema>;
    db: D1Database;
    kv: KVNamespace;
  }
}
