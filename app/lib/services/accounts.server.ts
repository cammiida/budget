import { AppLoadContext, redirect } from "@remix-run/cloudflare";
import { GoCardlessApi } from "../gocardless-api.server";
import { Account } from "../schema";
import { ServerArgs } from "../types";
import { getOrAddBank } from "./bank.server";
import { getOrCreateRequisition } from "./requisition.server";

export async function getAccountsForBank({
  bankId,
  context,
}: {
  bankId: string;
  context: AppLoadContext;
}): Promise<Account[]> {
  const user = context.user;
  if (!user) {
    throw redirect("/login");
  }

  const bank = await getOrAddBank({ bankId, context });
  const requisition = await getOrCreateRequisition({ bankId, context });
  const accountIds: string[] = requisition.accounts ?? [];

  const goCardlessApi = GoCardlessApi.create({ context });

  return await Promise.all(
    accountIds.map(async (accountId) => {
      const [accountDetails, accountBalances] = await Promise.all([
        goCardlessApi.getAccountDetails(accountId),
        goCardlessApi.getAccountBalances(accountId),
      ]);

      return {
        accountId,
        userId: user.id,
        bankId,
        name: accountDetails.account.name ?? `${bank.name} - ${accountId}`,
        ownerName: accountDetails.account.ownerName ?? "Unknown",
        balances: accountBalances.balances ?? [],
      } satisfies Account;
    })
  );
}
