import { json } from "@remix-run/cloudflare";
import { createPagesFunctionHandler } from "@remix-run/cloudflare-pages";
import * as build from "@remix-run/dev/server-build";
import { envSchema } from "env.server";

type PagesContext = { DB?: D1Database; KV?: KVNamespace };

export const onRequest: ReturnType<
  typeof createPagesFunctionHandler<PagesContext>
> = async (context) => {
  const { DB: db, KV: kv, ...rawEnv } = context.env;

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
    getLoadContext: (context) => {
      console.log("getLoadContext", context);

      return {
        ...context,
        env: env.data,
        waitUntil: context.waitUntil,
        db,
        kv,
      };
    },
  });

  return await handler(context);
};
