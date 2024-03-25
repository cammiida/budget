import type { ActionFunctionArgs, AppLoadContext } from "@remix-run/cloudflare";
import { json } from "@remix-run/cloudflare";
import { requireUser } from "~/lib/auth.server";
import type { GoogleSession } from "~/lib/cookie.server";
import { DbApi } from "~/lib/dbApi";
import { GoCardlessApi } from "~/lib/gocardless-api.server";
import type { Bank, NewAccount } from "~/lib/schema";

export async function action({ context }: ActionFunctionArgs) {
  const user = requireUser(context);

  const dbApi = DbApi.create({ context });
  const banks = await dbApi.getBanks();

  try {
    const savedAccounts = await Promise.all(
      banks.map((bank) => syncAccountsForBank(bank, context, user)),
    ).then((accounts) => accounts.flat());

    return json({
      savedAccounts,
    });
  } catch (error) {
    console.error("Failed to sync accounts", error);
    throw new Response("An error happened", { status: 500 });
  }
}

async function syncAccountsForBank(
  bank: Bank,
  context: AppLoadContext,
  user: GoogleSession,
) {
  const goCardlessApi = GoCardlessApi.create({ context });

  const requisition = bank?.requisitionId
    ? await goCardlessApi.getRequisition({
        requisitionId: bank.requisitionId,
      })
    : null;

  const accountIds: string[] = requisition?.accounts ?? [];

  const remoteAccounts = await Promise.all(
    accountIds.map(async (accountId) => {
      const [accountDetails, accountBalances] = await Promise.all([
        goCardlessApi.getAccountDetails(accountId),
        goCardlessApi.getAccountBalances(accountId),
      ]);

      return {
        accountId,
        accountDetails,
        accountBalances,
      };
    }),
  );

  const transformedAccounts = remoteAccounts.map(
    ({ accountId, accountDetails, accountBalances }) => {
      return {
        accountId,
        userId: user.id,
        bankId: bank.bankId,
        name: accountDetails.account.name ?? `${bank?.name} - ${accountId}`,
        ownerName: accountDetails.account.ownerName ?? "Unknown",
        balances: accountBalances.balances ?? [],
        bban: accountDetails.account.bban ?? null,
      } satisfies Required<NewAccount>;
    },
  );

  const savedAccounts = await DbApi.create({ context }).saveAccounts(
    transformedAccounts,
  );

  return savedAccounts;
}
