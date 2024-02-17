import { DataFunctionArgs } from "@remix-run/cloudflare";
import { Authenticator } from "remix-auth";
import { Profile, createSessionStorage } from "./cookie.server";

import {
  GoogleStrategyDefaultName,
  createGoogleStrategy,
} from "./google-strategy.server";

function createAuthenticator(
  args: Pick<DataFunctionArgs, "context" | "request">
) {
  const authenticator = new Authenticator<Profile>(
    createSessionStorage(args.context)
  );
  authenticator.use(createGoogleStrategy(args));

  return authenticator;
}

export function authenticate(args: DataFunctionArgs) {
  return createAuthenticator(args).authenticate(
    GoogleStrategyDefaultName,
    args.request,
    {
      successRedirect: "/",
      failureRedirect: "/auth/login",
    }
  );
}

export function logout(args: DataFunctionArgs) {
  return createAuthenticator(args).logout(args.request, {
    redirectTo: "/auth/login",
  });
}

export async function requireLogin(args: DataFunctionArgs) {
  return createAuthenticator(args).isAuthenticated(args.request, {
    failureRedirect: "/auth/login",
  });
}

export async function getUserSession(
  args: Pick<DataFunctionArgs, "context" | "request">
) {
  return createAuthenticator(args).isAuthenticated(args.request);
}
