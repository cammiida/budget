import { DataFunctionArgs } from "@remix-run/cloudflare";
import { Authenticator } from "remix-auth";
import { Profile, createSessionStorage } from "./cookie.server";

import {
  GoogleStrategyDefaultName,
  createGoogleStrategy,
} from "./google-strategy.server";

function createAuthenticator(args: DataFunctionArgs) {
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
      failureRedirect: "/login",
    }
  );
}

export function logout(args: DataFunctionArgs) {
  return createAuthenticator(args).logout(args.request, {
    redirectTo: "/login",
  });
}

export async function requireLogin(args: DataFunctionArgs) {
  return createAuthenticator(args).isAuthenticated(args.request, {
    failureRedirect: "/login",
  });
}

export async function getMe(args: DataFunctionArgs) {
  return createAuthenticator(args).isAuthenticated(args.request);
}

export function getOptionalMe(args: DataFunctionArgs) {
  return createAuthenticator(args).isAuthenticated(args.request);
}
