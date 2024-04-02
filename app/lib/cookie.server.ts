import type { Session, SessionData } from "@remix-run/cloudflare";
import { createCookieSessionStorage } from "@remix-run/cloudflare";
import type { Env } from "env.server";
import type { SpectacularJWTObtain } from "generated-sources/gocardless";
import type { GoogleProfile } from "./google-strategy.server";

export type GoogleSession = Pick<
  GoogleProfile,
  "displayName" | "name" | "_json"
> & {
  id: string;
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

export const flashSession = (env: Env) => {
  return createCookieSessionStorage<SessionData, SessionFlashData>({
    cookie: {
      name: "__flash_session", // use any name you want here
      httpOnly: true, // for security reasons, make this cookie http only
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/", // remember to add this so the cookie will work in all routes
      sameSite: "lax", // this helps with CSRF
      secrets: [env.SESSION_SECRET],
      secure: env.NODE_ENV === "production" ? true : false,
    },
  });
};

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
  sessionValue: SpectacularJWTObtain,
) {
  session.set("access", sessionValue.access);
  session.set(
    "access_expires",
    Date.now() + (sessionValue.access_expires ?? 0),
  );
  session.set("refresh", sessionValue.refresh);
  session.set(
    "refresh_expires",
    Date.now() + (sessionValue.refresh_expires ?? 0),
  );
  return session;
}

export function isAccessTokenValid(
  session: Session<SpectacularJWTObtain>,
): boolean {
  const access = session.get("access");
  const accessExpires = session.get("access_expires");
  return !!access && !!accessExpires && accessExpires > Date.now();
}

export function isRefreshTokenValid(
  session: Session<SpectacularJWTObtain>,
): boolean {
  const refresh = session.get("refresh");
  const refreshExpires = session.get("refresh_expires");
  return !!refresh && !!refreshExpires && refreshExpires > Date.now();
}
