import { LoaderArgs, createCookieSessionStorage } from "@remix-run/cloudflare";
import { z } from "zod";

export const goCardlessSchema = z.object({
  access: z.string(),
  access_expires: z.number(),
  refresh: z.string(),
  refresh_expires: z.number(),
});

export type GoCardless = z.infer<typeof goCardlessSchema>;
type GoCardlessSession = { goCardless: GoCardless };

const goCardlessStorage = createCookieSessionStorage<GoCardlessSession>({
  cookie: {
    name: "goCardless",
    secure: true,
    secrets: ["default_secret"],
    sameSite: "lax",
    path: "/",
    httpOnly: true,
  },
});

async function getGoCardlessSessionManager({
  request,
  context,
}: Pick<LoaderArgs, "request" | "context">) {
  const session = await goCardlessStorage.getSession(
    request.headers.get("Cookie")
  );

  function getSessionValue() {
    return session.get("goCardless");
  }

  function setSession(sessionValue: GoCardless) {
    session.set("goCardless", sessionValue);
  }

  function commit() {
    return goCardlessStorage.commitSession(session);
  }

  async function getSession() {
    if (getSessionValue()) {
      return session;
    }
    return getAccessToken();
  }

  async function getAccessToken() {
    // if no session value, get a new access token
    const accessTokenResponse = await fetch(
      `https://bankaccountdata.gocardless.com/api/v2/token/new/`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          secret_id: context.env.GO_CARDLESS_SECRET_ID,
          secret_key: context.env.GO_CARDLESS_SECRET_KEY,
        }),
      }
    );

    const body = await accessTokenResponse.json<GoCardless>();
    setSession(body);

    return session;
  }

  return {
    getSession,
    getSessionValue,
    setSession,
    commit,
    getAccessToken,
  };
}

export { getGoCardlessSessionManager };

export function refreshAccessToken(session: GoCardless) {
  // refresh the access token
  // TODO:
}
