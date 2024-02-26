import {
  Session,
  SessionData,
  createCookieSessionStorage,
} from "@remix-run/cloudflare";
import { Env } from "env.server";
import { SpectacularJWTObtain } from "generated-sources/gocardless";
import { GoogleProfile } from "./google-strategy.server";

export type GoogleSession = Pick<
  GoogleProfile,
  "displayName" | "name" | "_json"
> & {
  id: number;
  email: string;
  avatar?: string;
};

export type SessionFlashData = {
  error: string;
};

export const createSessionStorage = (env: Env) => {
  return createCookieSessionStorage({
    cookie: {
      name: "__session",
      httpOnly: true,
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
      sameSite: "lax",
      secrets: [env.SESSION_SECRET],
      secure: env.NODE_ENV === "production" ? true : false,
    },
  });
};

export const flashSession = createCookieSessionStorage<
  SessionData,
  SessionFlashData
>({
  cookie: {
    name: "__flash_session", // use any name you want here
    sameSite: "lax", // this helps with CSRF
    path: "/", // remember to add this so the cookie will work in all routes
    httpOnly: true, // for security reasons, make this cookie http only
    secrets: ["secretttokdoakdw"], // TODO: replace this with an actual secret
    secure: true, // enable this in prod only
    maxAge: 60 * 60 * 24 * 30,
  },
});

// GO_CARDLESS

export const goCardlessStorage =
  createCookieSessionStorage<SpectacularJWTObtain>({
    cookie: {
      name: "__goCardless",
      secure: true,
      secrets: ["default_secret"],
      sameSite: "lax",
      path: "/",
      httpOnly: true,
    },
  });

export function setGoCardlessSession(
  session: Session<SpectacularJWTObtain>,
  sessionValue: SpectacularJWTObtain
) {
  session.set("access", sessionValue.access);
  session.set(
    "access_expires",
    Date.now() + (sessionValue.access_expires ?? 0)
  );
  session.set("refresh", sessionValue.refresh);
  session.set(
    "refresh_expires",
    Date.now() + (sessionValue.refresh_expires ?? 0)
  );
  return session;
}

export function isAccessTokenValid(
  session: Session<SpectacularJWTObtain>
): boolean {
  const access = session.get("access");
  const accessExpires = session.get("access_expires");
  return !!access && !!accessExpires && accessExpires > Date.now();
}

export function isRefreshTokenValid(
  session: Session<SpectacularJWTObtain>
): boolean {
  const refresh = session.get("refresh");
  const refreshExpires = session.get("refresh_expires");
  return !!refresh && !!refreshExpires && refreshExpires > Date.now();
}
