import type { AppLoadContext } from "@remix-run/cloudflare";
import { redirect } from "@remix-run/cloudflare";
import type {
  BankTransactionStatusSchema,
  RequisitionRequest,
} from "generated-sources/gocardless";
import {
  AccountsService,
  ApiError,
  InstitutionsService,
  OpenAPI,
  RequisitionsService,
} from "generated-sources/gocardless";
import type { Bank } from "./schema";

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
      "no",
    );
  }

  async createRequisition({
    bankId,
    redirect,
  }: {
    bankId: string;
    redirect: RequisitionRequest["redirect"];
  }) {
    return await RequisitionsService.createRequisition({
      institution_id: bankId,
      redirect,
    });
  }

  async getRequisition({ requisitionId }: { requisitionId: string }) {
    if (!requisitionId) {
      return null;
    }

    try {
      return await RequisitionsService.requisitionById(requisitionId);
    } catch (error) {
      if (!(error instanceof ApiError)) {
        console.error(error);
        throw new Response("Could not get requisition", { status: 500 });
      }

      if (error.status === 404) {
        return null;
      }
      throw new Response("Could not get requisition", {
        ...error,
      });
    }
  }

  async getAccountBalances(accountId: string) {
    return AccountsService.retrieveAccountBalances(accountId);
  }

  async getAccountDetails(accountId: string) {
    return AccountsService.retrieveAccountDetails(accountId);
  }

  // FIXME: wrong type definition in the generated sources
  async getAccountTransactions(accountId: string, dateFrom?: string) {
    const transactions = await AccountsService.retrieveAccountTransactions(
      accountId,
      dateFrom,
    );

    return transactions as unknown as {
      transactions: BankTransactionStatusSchema;
    };
  }
}
