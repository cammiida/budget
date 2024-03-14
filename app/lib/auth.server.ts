import { Authenticator } from "remix-auth";
import type { GoogleSession } from "./cookie.server";
import { createSessionStorage } from "./cookie.server";

import {
  GoogleStrategy,
  GoogleStrategyDefaultName,
  createGoogleStrategy,
} from "./google-strategy.server";
import type { ServerArgs } from "./types";
import { redirect } from "@remix-run/cloudflare";
import { route } from "routes-gen";

function createAuthenticator(args: ServerArgs) {
  const authenticator = new Authenticator<GoogleSession>(
    createSessionStorage(args.context.env),
    GoogleStrategy.authenticatorOptions,
  );
  authenticator.use(createGoogleStrategy(args));

  return authenticator;
}

export function authenticate(args: ServerArgs) {
  return createAuthenticator(args).authenticate(
    GoogleStrategyDefaultName,
    args.request,
    {
      successRedirect: route("/"),
      failureRedirect: route("/auth/login"),
    },
  );
}

export function logout(args: ServerArgs) {
  return createAuthenticator(args).logout(args.request, {
    redirectTo: route("/auth/login"),
  });
}

export async function requireLogin(args: ServerArgs) {
  const user = args.context.user;
  if (!user) {
    throw redirect(route("/auth/login"));
  }
}

export async function getUserSession(args: ServerArgs) {
  return createAuthenticator(args).isAuthenticated(args.request);
}
