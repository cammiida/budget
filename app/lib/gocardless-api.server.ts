import {
  DataFunctionArgs,
  Session,
  createCookieSessionStorage,
} from "@remix-run/cloudflare";
import { z } from "zod";
import { bankSchema } from "~/routes/banks";
import { getUserSession } from "./auth.server";
import { DbApi } from "./dbApi";

export const goCardlessSessionSchema = z.object({
  access: z.string(),
  access_expires: z.number(),
  refresh: z.string(),
  refresh_expires: z.number(),
});

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
  goCardless: z.infer<typeof goCardlessSessionSchema>;
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

  async getSession(): Promise<GoCardlessSession> {
    const currentSession = await goCardlessStorage.getSession(
      this.request.headers.get("Cookie")
    );
    if (!currentSession.data.goCardless) {
      return this.getAccessToken();
    }

    return currentSession;
  }

  async setSession(sessionValue: GoCardlessSessionData["goCardless"]) {
    return this.session.set("goCardless", sessionValue);
  }

  async commitSession() {
    return goCardlessStorage.commitSession(this.session);
  }

  async getAccessToken(): Promise<GoCardlessSession> {
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
      .then((res) => goCardlessSessionSchema.parse(res));

    await this.setSession(response);
    await goCardlessStorage.commitSession(this.session);

    return this.session;
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
}
