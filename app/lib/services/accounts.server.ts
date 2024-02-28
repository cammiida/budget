import { AppLoadContext, redirect } from "@remix-run/cloudflare";
import { DbApi } from "../dbApi";
import { GoCardlessApi } from "../gocardless-api.server";
import { Account } from "../schema";

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

  const dbApi = DbApi.create({ context });
  const goCardlessApi = GoCardlessApi.create({ context });
  const bank = await dbApi.getBank(bankId);
  const requisition = bank?.requisitionId
    ? await goCardlessApi.getRequisition({
        requisitionId: bank.requisitionId,
      })
    : null;

  const accountIds: string[] = requisition?.accounts ?? [];

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
        name: accountDetails.account.name ?? `${bank?.name} - ${accountId}`,
        ownerName: accountDetails.account.ownerName ?? "Unknown",
        balances: accountBalances.balances ?? [],
      } satisfies Account;
    })
  );
}
