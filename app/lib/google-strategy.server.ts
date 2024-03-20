import { eq } from "drizzle-orm";
import type { AuthenticatorOptions, StrategyVerifyCallback } from "remix-auth";
import type {
  OAuth2Profile,
  OAuth2StrategyVerifyParams,
} from "remix-auth-oauth2";
import { OAuth2Strategy } from "remix-auth-oauth2";
import type { GoogleSession } from "./cookie.server";
import { getDbFromContext } from "./db.service.server";
import { users } from "./schema";
import type { ServerArgs } from "./types";

export function createGoogleStrategy(args: ServerArgs) {
  const url = new URL(args.request.url);

  // So that redirects work for all three variants
  if (url.hostname === "0.0.0.0" || url.hostname === "127.0.0.1") {
    url.hostname = "localhost";
  }

  const db = getDbFromContext(args.context);

  return new GoogleStrategy<GoogleSession>(
    {
      clientID: args.context.env.GOOGLE_CLIENT_ID,
      clientSecret: args.context.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${url.protocol}//${url.host}/auth/google/callback`,
    },
    async ({ profile }) => {
      const email = profile.emails[0].value;

      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1)
        .get();

      if (existingUser) {
        return {
          id: existingUser.id,
          displayName: profile.displayName,
          name: profile.name,
          email,
          avatar: profile.photos[0]?.value,
          _json: profile._json,
        };
      }

      throw new Error("You are not authorized to access this site");
    },
  );
}

/**
 * @see https://developers.google.com/identity/protocols/oauth2/scopes
 */
export type GoogleScope = string;

export type GoogleStrategyOptions = {
  clientID: string;
  clientSecret: string;
  callbackURL: string;
  /**
   * @default "openid profile email"
   */
  scope?: GoogleScope[] | string;
  accessType?: "online" | "offline";
  includeGrantedScopes?: boolean;
  prompt?: "none" | "consent" | "select_account";
  hd?: string;
  loginHint?: string;
};

export type GoogleProfile = {
  id: string;
  displayName: string;
  name: {
    familyName: string;
    givenName: string;
  };
  emails: [{ value: string }];
  photos: [{ value: string }];
  _json: {
    sub: string;
    name: string;
    given_name: string;
    family_name: string;
    picture: string;
    locale: string;
    email: string;
    email_verified: boolean;
    hd: string;
  };
} & OAuth2Profile;

export type GoogleExtraParams = {
  expires_in: 3920;
  token_type: "Bearer";
  scope: string;
  id_token: string;
} & Record<string, string | number>;

export const GoogleStrategyScopeSeperator = " ";
export const GoogleStrategyDefaultScopes = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/userinfo.email",
].join(GoogleStrategyScopeSeperator);
export const GoogleStrategyDefaultName = "google";

export class GoogleStrategy<User> extends OAuth2Strategy<
  User,
  GoogleProfile,
  GoogleExtraParams
> {
  static authenticatorOptions: Required<AuthenticatorOptions> = {
    sessionKey: "google:session",
    sessionErrorKey: "google:error",
    sessionStrategyKey: "strategy",
    throwOnError: true,
  };

  public name = GoogleStrategyDefaultName;

  private readonly accessType: string;

  private readonly prompt?: "none" | "consent" | "select_account";

  private readonly includeGrantedScopes: boolean;

  private readonly hd?: string;

  private readonly loginHint?: string;

  private readonly userInfoURL =
    "https://www.googleapis.com/oauth2/v3/userinfo";

  constructor(
    {
      clientID,
      clientSecret,
      callbackURL,
      scope,
      accessType,
      includeGrantedScopes,
      prompt,
      hd,
      loginHint,
    }: GoogleStrategyOptions,
    verify: StrategyVerifyCallback<
      User,
      OAuth2StrategyVerifyParams<GoogleProfile, GoogleExtraParams>
    >,
  ) {
    super(
      {
        clientID,
        clientSecret,
        callbackURL,
        authorizationURL: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenURL: "https://oauth2.googleapis.com/token",
      },
      verify,
    );
    this.scope = this.parseScope(scope);
    this.accessType = accessType ?? "online";
    this.includeGrantedScopes = includeGrantedScopes ?? false;
    this.prompt = prompt;
    this.hd = hd;
    this.loginHint = loginHint;
  }

  protected authorizationParams(): URLSearchParams {
    const params = new URLSearchParams({
      access_type: this.accessType,
      include_granted_scopes: String(this.includeGrantedScopes),
    });
    if (this.prompt) {
      params.set("prompt", this.prompt);
    }
    if (this.hd) {
      params.set("hd", this.hd);
    }
    if (this.loginHint) {
      params.set("login_hint", this.loginHint);
    }
    return params;
  }

  protected async userProfile(accessToken: string): Promise<GoogleProfile> {
    const response = await fetch(this.userInfoURL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const raw: GoogleProfile["_json"] = await response.json();
    const profile: GoogleProfile = {
      provider: "google",
      id: raw.sub,
      displayName: raw.name,
      name: {
        familyName: raw.family_name,
        givenName: raw.given_name,
      },
      emails: [{ value: raw.email }],
      photos: [{ value: raw.picture }],
      _json: raw,
    };
    return profile;
  }

  // Allow users the option to pass a scope string, or typed array
  private parseScope(scope: GoogleStrategyOptions["scope"]) {
    if (!scope) {
      return GoogleStrategyDefaultScopes;
    } else if (Array.isArray(scope)) {
      return scope.join(GoogleStrategyScopeSeperator);
    }

    return scope;
  }
}
