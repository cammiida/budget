import {
  AppLoadContext,
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
import { Account, Bank } from "./schema";
import { ServerArgs } from "./types";

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

  private constructor({
    request,
    context,
    session,
  }: ServerArgs & {
    session: GoCardlessSession;
  }) {
    this.request = request;
    this.context = context;
    this.session = session;
  }

  static async create(args: ServerArgs) {
    const session = await goCardlessStorage.getSession(
      args.request.headers.get("Cookie")
    ); // TODO: add this to context
    OpenAPI.TOKEN = session.data.goCardless?.access;

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

  getCurrentUser() {
    const user = this.context.session;
    if (!user) {
      throw redirect("/auth/login");
    }
    return user;
  }

  async getBank({ bankId }: { bankId: string }): Promise<Bank> {
    const result = await InstitutionsService.retrieveInstitution(bankId);

    return {
      bankId,
      userId: this.getCurrentUser().id,
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

  async createRequisition(bankId: string) {
    const requisition = await RequisitionsService.createRequisition({
      institution_id: bankId,
      redirect: "http://172.24.134.19:8788/api/authenticate-bank",
    });

    return requisition;
  }

  async getRequisition({ requisitionId }: { requisitionId: string }) {
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

  async getAccountsForBank({ bankId }: { bankId: string }): Promise<Account[]> {
    const bank = await this.getBank({ bankId });
    if (!bank.requisitionId) {
      throw new Response("Requisition not found", { status: 404 });
    }

    const requisition = await this.getRequisition({
      requisitionId: bank.requisitionId,
    });

    return Promise.all(
      requisition.accounts?.map((accountId) =>
        this.getAccountDetails({ bankId, accountId })
      ) ?? []
    );
  }

  async getAccountBalances(accountId: string) {
    return AccountsService.retrieveAccountBalances(accountId);
  }

  async getAccountDetails({
    bankId,
    accountId,
  }: {
    bankId: string;
    accountId: string;
  }): Promise<Account> {
    const userId = this.getCurrentUser().id;

    const [accountDetails, accountBalances] = await Promise.all([
      AccountsService.retrieveAccountDetails(accountId),
      AccountsService.retrieveAccountBalances(accountId),
    ]);

    return {
      accountId,
      userId,
      bankId,
      name:
        accountDetails.account.name ?? `${userId} - ${bankId} - ${accountId}`,
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
