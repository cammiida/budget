import type { Session } from "@remix-run/cloudflare";
import type { Env } from "env.server";
import type { GoCardlessSessionData, GoogleSession } from "~/lib/cookie.server";

declare module "@remix-run/cloudflare" {
  interface AppLoadContext {
    waitUntil: EventContext<unknown, unknown, unknown>["waitUntil"];
    env: Env;
    db: D1Database;
    user: GoogleSession | null;
    goCardlessSession: Session<GoCardlessSessionData>;
    session: Session;
  }
}
