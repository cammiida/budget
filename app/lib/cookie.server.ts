import {
  AppLoadContext,
  createCookieSessionStorage,
} from "@remix-run/cloudflare";
import { GoogleProfile } from "./google-strategy.server";

export type Profile = Pick<GoogleProfile, "id" | "displayName" | "name"> & {
  email: string;
  avatar?: string;
};

type SessionFlashData = {
  error: string;
};

export const createSessionStorage = (context: AppLoadContext) =>
  createCookieSessionStorage({
    cookie: {
      name: "__session",
      httpOnly: true,
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
      sameSite: "lax",
      secrets: [context.env.SESSION_SECRET],
      secure: context.env.NODE_ENV === "production" ? true : false,
    },
  });

export const flashSession = createCookieSessionStorage<
  Profile,
  SessionFlashData
>({
  cookie: {
    name: "PP_flash_session", // use any name you want here
    sameSite: "lax", // this helps with CSRF
    path: "/", // remember to add this so the cookie will work in all routes
    httpOnly: true, // for security reasons, make this cookie http only
    secrets: ["secretttokdoakdw"], // replace this with an actual secret
    secure: true, // enable this in prod only
    maxAge: 60 * 60 * 24 * 30,
  },
});
