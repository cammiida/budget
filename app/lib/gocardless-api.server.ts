import {
  AppLoadContext,
  Session,
  createCookieSessionStorage,
} from "@remix-run/cloudflare";
import {
  AccountsService,
  BalanceSchema,
  DetailSchema,
  InstitutionsService,
  OpenAPI,
  RequisitionsService,
} from "generated-sources/gocardless";
import { z } from "zod";
import { DbApi } from "./dbApi";
import { Account, Bank, User } from "./schema";
import { ServerArgs } from "./types";

export type ServerAccount = {
  accountId: string;
  balances: BalanceSchema[];
} & DetailSchema;

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
  private request: Request;
  private context: AppLoadContext;
  private session: GoCardlessSession;
  private user: User;

  private constructor({
    request,
    context,
    session,
    user,
  }: ServerArgs & {
    session: GoCardlessSession;
    user: User;
  }) {
    this.request = request;
    this.context = context;
    this.session = session;
    this.user = user;
  }

  static async create(args: ServerArgs) {
    const session = await goCardlessStorage.getSession(
      args.request.headers.get("Cookie")
    );
    OpenAPI.TOKEN = (
      await goCardlessStorage.getSession(args.request.headers.get("Cookie"))
    ).data.goCardless?.access;

    const dbApi = DbApi.create(args);
    const user = await dbApi.requireUser();
    return new GoCardlessApi({ ...args, session, user });
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

  async getBank(bankId: string): Promise<Bank> {
    const result = await InstitutionsService.retrieveInstitution(bankId);
    return {
      bankId,
      userId: this.user.id,
      requisitionId: null,
      name: result.name,
      bic: result.bic ?? null,
      logo: result.logo,
    };
  }

  async getAllBanks() {
    return InstitutionsService.retrieveAllSupportedInstitutionsInAGivenCountry(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      "no"
    );
  }

  async getRequisition(requisitionId: string) {
    try {
      return RequisitionsService.requisitionById(requisitionId);
    } catch (error) {
      if (error instanceof Error) {
        console.error(error.message);
      }
      // TODO: improve error handling
      throw new Response("An error happened", { status: 500 });
    }
  }

  async createRequisition(bankId: string) {
    return RequisitionsService.createRequisition({
      institution_id: bankId,
      redirect: "http://172.24.134.19:8788/api/authenticate-bank",
    });
  }

  async getAccountsForBank(bankId: string) {
    const requisition = await this.getRequisition(bankId);

    if (!requisition.accounts) {
      return [];
    }

    return Promise.all(
      requisition.accounts.map((accountId) =>
        this.getAccountDetails(bankId, accountId)
      )
    );
  }

  async getAccountBalances(accountId: string) {
    return AccountsService.retrieveAccountBalances(accountId);
  }

  async getAccountDetails(bankId: string, accountId: string): Promise<Account> {
    const [accountDetails, accountBalances] = await Promise.all([
      AccountsService.retrieveAccountDetails(accountId),
      AccountsService.retrieveAccountBalances(accountId),
    ]);

    return {
      accountId,
      userId: this.user.id,
      bankId,
      name:
        accountDetails.account.name ??
        `${this.user.id} - ${bankId} - ${accountId}`,
      ...accountDetails.account,
      ownerName: accountDetails.account.ownerName ?? "",
      balances: accountBalances.balances ?? [],
    };
  }

  async getAccountTransactions(accountId: string) {
    OpenAPI.TOKEN = (await this.getSession()).data.goCardless?.access;
    return AccountsService.retrieveAccountTransactions(accountId);
  }
}
