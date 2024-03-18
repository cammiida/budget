import type { AppLoadContext } from "@remix-run/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

const contextWithDb = (
  context: Record<string, unknown>,
): context is { db: D1Database } => {
  return "db" in context;
};

export const getDbFromContext = (context: AppLoadContext) => {
  if (!contextWithDb(context)) {
    throw new Error("No database in context");
  }

  return drizzle(context.db, { schema });
};
