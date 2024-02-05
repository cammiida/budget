import {
  AppLoadContext,
  createCookieSessionStorage,
  json,
} from "@remix-run/cloudflare";
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

async function getGoCardlessSession(request: Request) {
  const session = await goCardlessStorage.getSession(
    request.headers.get("Cookie")
  );

  return {
    getSessionValue: () => session.get("goCardless"),
    setSession: (sessionValue: GoCardless) =>
      session.set("goCardless", sessionValue),
    commit: () => goCardlessStorage.commitSession(session),
  };
}

export async function goCardlessLogin(
  request: Request,
  context: AppLoadContext
) {
  const session = await getGoCardlessSession(request);
  const sessionValue = session.getSessionValue();

  // TODO: refresh the access token if it has expired
  if (!!sessionValue) {
    return session;
  }

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
  session.setSession(body);

  return session;
}

export function refreshAccessToken(session: GoCardless) {
  // refresh the access token
  // TODO:
}

export { getGoCardlessSession };
