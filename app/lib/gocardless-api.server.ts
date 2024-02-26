import { AppLoadContext, redirect } from "@remix-run/cloudflare";
import {
  AccountsService,
  InstitutionsService,
  OpenAPI,
  RequisitionsService,
} from "generated-sources/gocardless";
import { Account, Bank } from "./schema";

export class GoCardlessApi {
  private context: AppLoadContext;

  private constructor({ context }: { context: AppLoadContext }) {
    this.context = context;
  }

  static create(args: { context: AppLoadContext }) {
    OpenAPI.TOKEN = args.context.goCardlessSession.data.access;

    return new GoCardlessApi(args);
  }

  getCurrentUser() {
    const user = this.context.user;
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
    return AccountsService.retrieveAccountTransactions(accountId);
  }
}
