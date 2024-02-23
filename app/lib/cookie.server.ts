import {
  AppLoadContext,
  SessionData,
  createCookieSessionStorage,
} from "@remix-run/cloudflare";
import { GoogleProfile } from "./google-strategy.server";
import { Env } from "env.server";

export type Session = Pick<GoogleProfile, "displayName" | "name" | "_json"> & {
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
    name: "PP_flash_session", // use any name you want here
    sameSite: "lax", // this helps with CSRF
    path: "/", // remember to add this so the cookie will work in all routes
    httpOnly: true, // for security reasons, make this cookie http only
    secrets: ["secretttokdoakdw"], // TODO: replace this with an actual secret
    secure: true, // enable this in prod only
    maxAge: 60 * 60 * 24 * 30,
  },
});
