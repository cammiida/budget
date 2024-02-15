import {
  DataFunctionArgs,
  Session,
  createCookieSessionStorage,
  redirect,
} from "@remix-run/cloudflare";
import {
  AccountsService,
  InstitutionsService,
  OpenAPI,
  RequisitionsService,
} from "generated-sources/gocardless";
import { z } from "zod";
import { getUserSession } from "./auth.server";
import { DbApi } from "./dbApi";

export const accessTokenSchema = z.object({
  access: z.string(),
  access_expires: z.number(),
});

type AccessToken = z.infer<typeof accessTokenSchema>;

export const refreshTokenSchema = z.object({
  refresh: z.string(),
  refresh_expires: z.number(),
});

type RefreshToken = z.infer<typeof refreshTokenSchema>;

const goCardlessStorage = createCookieSessionStorage<GoCardlessSessionData>({
  cookie: {
    name: "goCardless",
    secure: true,
    secrets: ["default_secret"],
    sameSite: "lax",
    path: "/",
    httpOnly: true,
  },
});

type GoCardlessSessionData = {
  goCardless: AccessToken & Partial<RefreshToken>;
};
type GoCardlessSession = Session<GoCardlessSessionData>;

export class GoCardlessApi {
  private request: DataFunctionArgs["request"];
  private context: DataFunctionArgs["context"];
  private session: GoCardlessSession;

  private constructor({
    request,
    context,
    session,
  }: Pick<DataFunctionArgs, "request" | "context"> & {
    session: GoCardlessSession;
  }) {
    this.request = request;
    this.context = context;
    this.session = session;
  }

  static async create(args: Pick<DataFunctionArgs, "request" | "context">) {
    const session = await goCardlessStorage.getSession(
      args.request.headers.get("Cookie")
    );
    return new GoCardlessApi({ ...args, session });
  }

  async authorize() {
    const session = await this.getSession();

    // No session? Get new tokens
    if (!session.data.goCardless) {
      return this.getNewTokens();
    }

    // Access token not expired? Return session
    if (!this.hasAccessTokenExpired(session)) {
      return session;
    }

    // Refresh token not expired? Refresh token
    if (!this.hasRefreshTokenExpired(session)) {
      return this.refreshAccessToken();
    }

    // Refresh token expired? Get new tokens
    return this.getNewTokens();
  }

  async getSession(): Promise<GoCardlessSession> {
    const currentSession = await goCardlessStorage.getSession(
      this.request.headers.get("Cookie")
    );

    return currentSession;
  }

  async setSession(sessionValue: GoCardlessSessionData["goCardless"]) {
    return this.session.set("goCardless", sessionValue);
  }

  async commitSession() {
    return goCardlessStorage.commitSession(this.session);
  }

  private async getNewTokens(): Promise<GoCardlessSession> {
    const response = await fetch(
      `https://bankaccountdata.gocardless.com/api/v2/token/new/`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          secret_id: this.context.env.GO_CARDLESS_SECRET_ID,
          secret_key: this.context.env.GO_CARDLESS_SECRET_KEY,
        }),
      }
    )
      .then((res) => res.json())
      .then((res) => accessTokenSchema.and(refreshTokenSchema).parse(res));

    await this.setSession({
      ...response,
      access_expires: Date.now() + response.access_expires, // TODO: convert to ms
      refresh_expires: Date.now() + response.refresh_expires, // TODO: convert to ms
    });

    return this.session;
  }

  private async refreshAccessToken(): Promise<GoCardlessSession> {
    const refreshToken = (await this.getSession()).data.goCardless?.refresh;
    const response = await fetch(
      `https://bankaccountdata.gocardless.com/api/v2/token/refresh/`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          refresh: refreshToken,
        }),
      }
    )
      .then((res) => res.json())
      .then((res) => accessTokenSchema.parse(res));

    await this.setSession({
      ...this.session.data.goCardless,
      access: response.access,
      access_expires: Date.now() + response.access_expires, // TODO: convert to ms
    });

    return this.session;
  }

  private hasAccessTokenExpired(session: GoCardlessSession): boolean {
    const accessToken = session.data.goCardless?.access;
    const access_expires = session.data.goCardless?.access_expires;

    if (accessToken && access_expires && access_expires > Date.now()) {
      return false;
    }

    return true;
  }

  private hasRefreshTokenExpired(session: GoCardlessSession): boolean {
    const refreshToken = session.data.goCardless?.refresh;
    const refresh_expires = session.data.goCardless?.refresh_expires;

    if (refreshToken && refresh_expires && refresh_expires > Date.now()) {
      return false;
    }

    return true;
  }

  async getAllBanks() {
    OpenAPI.TOKEN = (await this.getSession()).data.goCardless?.access;
    return InstitutionsService.retrieveAllSupportedInstitutionsInAGivenCountry(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      "no"
    );
  }

  async getChosenBanks() {
    const session = await getUserSession({
      request: this.request,
      context: this.context,
    });

    if (!session) {
      throw new Error("User not found");
    }

    const allBanks = await this.getAllBanks();
    const userApi = DbApi.create({
      request: this.request,
      context: this.context,
    });
    const user = await userApi.getUserByEmail(session.email);
    const chosenBankIds = await userApi.getAllBanksForUser(user.id);

    return allBanks.filter((bank) => chosenBankIds.includes(bank.id));
  }

  async getRequisition(bankId: string) {
    const api = DbApi.create({ context: this.context, request: this.request });
    const session = await getUserSession({
      context: this.context,
      request: this.request,
    });

    const user = session ? await api.getUserByEmail(session.email) : null;
    if (!user) {
      throw redirect("/login");
    }

    const bankRelation = await api.getBankRelation(user.id, bankId);
    if (!bankRelation) {
      throw new Response("Bank relation not found", { status: 404 });
    }

    OpenAPI.TOKEN = (await this.getSession()).data.goCardless?.access;
    try {
      return RequisitionsService.requisitionById(bankRelation.requisitionId);
    } catch (error) {
      if (error instanceof Error) {
        console.error(error.message);
      }
      // TODO: improve error handling
      throw new Response("An error happened", { status: 500 });
    }
  }

  async createRequisition(institutionId: string) {
    OpenAPI.TOKEN = (await this.getSession()).data.goCardless?.access;

    return RequisitionsService.createRequisition({
      institution_id: institutionId,
      redirect: "http://172.24.134.19:8788/api/authenticate-bank",
    });
  }

  async getAccountBalances(accountId: string) {
    OpenAPI.TOKEN = (await this.getSession()).data.goCardless?.access;
    return AccountsService.retrieveAccountBalances(accountId);
  }
}
