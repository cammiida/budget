import "@remix-run/cloudflare";
import { Env } from "env.server";
import { Session } from "~/lib/cookie.server";

declare module "@remix-run/cloudflare" {
  interface AppLoadContext {
    waitUntil: EventContext<unknown, unknown, unknown>["waitUntil"];
    env: Env;
    db: D1Database;
    session: Session | null;
  }
}
