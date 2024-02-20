import { AppLoadContext, json } from "@remix-run/cloudflare";
import { createPagesFunctionHandler } from "@remix-run/cloudflare-pages";
import * as build from "@remix-run/dev/server-build";
import { envSchema } from "env.server";

type PagesContext = { DB: D1Database };

export const onRequest: ReturnType<
  typeof createPagesFunctionHandler<PagesContext>
> = async (context) => {
  const { DB: db, ...rawEnv } = context.env;

  // Don't bother with the parsing, we just want to make sure the DB exists
  if (!db) {
    return json(
      {
        message: "Missing DB binding",
      },
      {
        status: 500,
      }
    );
  }

  const env = envSchema.safeParse(rawEnv);
  if (!env.success) {
    return json(
      {
        message: "Invalid environment",
        error: env.error,
      },
      {
        status: 500,
      }
    );
  }

  const handler = createPagesFunctionHandler({
    build,
    mode: process.env.NODE_ENV,
    getLoadContext: (context): AppLoadContext => {
      return {
        ...context,
        env: env.data,
        waitUntil: context.waitUntil,
        db,
      };
    },
  });

  return await handler(context);
};
