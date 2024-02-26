import { AppLoadContext, Session, json } from "@remix-run/cloudflare";
import {
  createPagesFunctionHandlerParams,
  createRequestHandler,
} from "@remix-run/cloudflare-pages";
import * as build from "@remix-run/dev/server-build";
import { envSchema } from "env.server";
import {
  SpectacularJWTObtain,
  TokenService,
} from "generated-sources/gocardless";
import {
  GoogleSession,
  createSessionStorage,
  goCardlessStorage,
  isAccessTokenValid,
  isRefreshTokenValid,
  setGoCardlessSession,
} from "~/lib/cookie.server";
import { GoogleStrategy } from "~/lib/google-strategy.server";

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

  const cookieHeader = context.request.headers.get("Cookie");
  const goCardlessSession = await goCardlessStorage.getSession(cookieHeader);
  const session = await createSessionStorage(env.data).getSession(cookieHeader);

  const user: GoogleSession | null = session.get(
    GoogleStrategy.authenticatorOptions.sessionKey
  );

  const handler = createPagesFunctionHandler({
    build,
    mode: process.env.NODE_ENV,
    getLoadContext: (context): AppLoadContext => {
      return {
        ...context,
        env: env.data,
        db,
        session,
        goCardlessSession,
        user,
      };
    },
  });

  return await handler(context);
};

export function createPagesFunctionHandler<Env = any>({
  build,
  getLoadContext,
  mode,
}: createPagesFunctionHandlerParams<Env>) {
  let handleRequest = createRequestHandler<Env>({
    build,
    getLoadContext,
    mode,
  });

  let handleFetch = async (context: EventContext<Env, any, any>) => {
    let response: Response | undefined;

    // https://github.com/cloudflare/wrangler2/issues/117
    context.request.headers.delete("if-none-match");

    try {
      response = await context.env.ASSETS.fetch(
        context.request.url,
        context.request.clone()
      );
      response =
        response && response.status >= 200 && response.status < 400
          ? new Response(response.body, response)
          : undefined;
    } catch {}

    if (!response) {
      response = await handleRequest(context);
    }

    const loadContext = await getLoadContext?.(context);
    if (loadContext) {
      // don't authorize goCardless if user is not logged in
      const goCardlessSession = loadContext.user
        ? await authorizeGoCardless(loadContext)
        : loadContext.goCardlessSession;

      loadContext.goCardlessSession = goCardlessSession;

      response.headers.append(
        "Set-Cookie",
        await goCardlessStorage.commitSession(loadContext.goCardlessSession)
      );
    }

    return response;
  };

  return async (context: EventContext<Env, any, any>) => {
    try {
      return await handleFetch(context);
    } catch (error: unknown) {
      if (process.env.NODE_ENV === "development" && error instanceof Error) {
        console.error(error);
        return new Response(error.message || error.toString(), {
          status: 500,
        });
      }

      return new Response("Internal Error", {
        status: 500,
      });
    }
  };
}

async function authorizeGoCardless(
  context: AppLoadContext
): Promise<Session<SpectacularJWTObtain>> {
  const session = context.goCardlessSession;
  // Access token not expired? Return session
  if (isAccessTokenValid(session)) {
    return session;
  }

  // Refresh token not expired? Refresh token
  if (isRefreshTokenValid(session)) {
    const res = await TokenService.getANewAccessToken({
      refresh: session.data.refresh,
    });

    return setGoCardlessSession(session, res);
  }

  // Refresh token expired? Get new tokens
  const res = await TokenService.obtainNewAccessRefreshTokenPair({
    secret_id: context.env.GO_CARDLESS_SECRET_ID,
    secret_key: context.env.GO_CARDLESS_SECRET_KEY,
  });

  return setGoCardlessSession(session, {
    ...session.data,
    ...res,
  });
}
