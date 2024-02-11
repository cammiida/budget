import {
  DataFunctionArgs,
  Session,
  createCookieSessionStorage,
  redirect,
} from "@remix-run/cloudflare";
import { z } from "zod";
import { bankSchema } from "~/routes/banks._index";
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
    const accessToken = (await this.getSession()).data.goCardless?.access;

    const response = await fetch(
      "https://bankaccountdata.gocardless.com/api/v2/institutions/?country=no",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
      }
    ).then((res) => res.json());

    const parsedBanks = bankSchema.array().safeParse(response);

    const banks = parsedBanks.success ? parsedBanks.data : [];

    return banks;
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
    const accessToken = (await this.getSession()).data.goCardless?.access;
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

    const response = await fetch(
      `https://bankaccountdata.gocardless.com/api/v2/requisitions/${bankRelation.requisitionId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      }
    )
      .then((res) => res.json())
      .then((res) => {
        return requisitionSchema.parse(res);
      });

    return response;
  }

  async createRequisition(institutionId: string) {
    const goCardlessApi = await GoCardlessApi.create({
      context: this.context,
      request: this.request,
    });
    const goCardlessSession = await goCardlessApi.authorize();

    const response = await fetch(
      "https://bankaccountdata.gocardless.com/api/v2/requisitions/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${goCardlessSession.data.goCardless?.access}`,
        },
        body: JSON.stringify({
          redirect: "http://172.24.134.19:8788/api/authenticate-bank",
          institution_id: institutionId,
        }),
      }
    )
      .then((res) => res.json())
      .then((res) => bankLinkSchema.parse(res));

    return response;
  }

  async getAccountBalances(accountId: string) {
    const accessToken = (await this.getSession()).data.goCardless?.access;

    const response = await fetch(
      `https://bankaccountdata.gocardless.com/api/v2/accounts/${accountId}/balances/`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
      }
    )
      .then((res) => res.json())
      .then((res) => balanceSchema.parse(res).balances);

    return response;
  }
}

const balanceSchema = z.object({
  balances: z.array(
    z.object({
      balanceAmount: z.object({
        amount: z.string(),
        currency: z.string(),
      }),
      balanceType: z.enum(["openingBooked", "interimAvailable", "expected"]),
    })
  ),
});

const requisitionSchema = z.object({
  id: z.string(),
  created: z.string(),
  redirect: z.string(),
  status: z.string(),
  institution_id: z.string(),
  agreement: z.string(),
  reference: z.string(),
  accounts: z.string().array(),
  link: z.string(),
  ssn: z.string().nullable(),
  account_selection: z.boolean(),
  redirect_immediate: z.boolean(),
});

export const bankLinkSchema = z.object({ id: z.string(), link: z.string() });
export type BankLink = z.infer<typeof bankLinkSchema>;
