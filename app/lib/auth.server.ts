import { Authenticator } from "remix-auth";
import { Profile, createSessionStorage } from "./cookie.server";

import {
  GoogleStrategyDefaultName,
  createGoogleStrategy,
} from "./google-strategy.server";
import { ServerArgs } from "./types";

function createAuthenticator(args: ServerArgs) {
  const authenticator = new Authenticator<Profile>(
    createSessionStorage(args.context)
  );
  authenticator.use(createGoogleStrategy(args));

  return authenticator;
}

export function authenticate(args: ServerArgs) {
  return createAuthenticator(args).authenticate(
    GoogleStrategyDefaultName,
    args.request,
    {
      successRedirect: "/",
      failureRedirect: "/auth/login",
    }
  );
}

export function logout(args: ServerArgs) {
  return createAuthenticator(args).logout(args.request, {
    redirectTo: "/auth/login",
  });
}

export async function requireLogin(args: ServerArgs) {
  return createAuthenticator(args).isAuthenticated(args.request, {
    failureRedirect: "/auth/login",
  });
}

export async function getUserSession(args: ServerArgs) {
  return createAuthenticator(args).isAuthenticated(args.request);
}
