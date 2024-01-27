import { DataFunctionArgs } from "@remix-run/cloudflare";
import { Authenticator } from "remix-auth";
import { users } from "~/lib/schema";
import { Profile, createSessionStorage } from "./cookie.server";

import { eq } from "drizzle-orm";
import { getDbFromContext } from "./db.service.server";
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

export async function getMe(args: DataFunctionArgs) {
  const userSession = await createAuthenticator(args).isAuthenticated(
    args.request
  );
  const db = getDbFromContext(args.context);
  if (!userSession) {
    return null;
  }

  return db
    .select({
      id: users.id,
      email: users.email,
      avatar: users.avatar,
      name: users.name,
    })
    .from(users)
    .where(eq(users.email, userSession.email))
    .get();
}

export function getOptionalMe(args: DataFunctionArgs) {
  return createAuthenticator(args).isAuthenticated(args.request);
}
