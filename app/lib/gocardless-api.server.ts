import { AppLoadContext, redirect } from "@remix-run/cloudflare";
import {
  AccountsService,
  ApiError,
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

  async getAccountTransactions(accountId: string) {
    return AccountsService.retrieveAccountTransactions(accountId);
  }
}
