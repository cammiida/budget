import { Authenticator } from "remix-auth";
import { Session, createSessionStorage } from "./cookie.server";

import {
  GoogleStrategy,
  GoogleStrategyDefaultName,
  createGoogleStrategy,
} from "./google-strategy.server";
import { ServerArgs } from "./types";

function createAuthenticator(args: ServerArgs) {
  const authenticator = new Authenticator<Session>(
    createSessionStorage(args.context.env),
    GoogleStrategy.authenticatorOptions
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
