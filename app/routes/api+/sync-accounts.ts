import type { ActionFunctionArgs } from "@remix-run/cloudflare";
import { json, redirect } from "@remix-run/cloudflare";
import { DbApi } from "~/lib/dbApi";
import { GoCardlessApi } from "~/lib/gocardless-api.server";
import type { NewAccount } from "~/lib/schema";

export async function action({ context, request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const bankId = formData.get("bankId")?.toString();

  if (!bankId) {
    throw new Response("Bank ID is required", { status: 400 });
  }

  const user = context.user;
  if (!user) {
    throw redirect("/login");
  }

  try {
    const dbApi = DbApi.create({ context });
    const goCardlessApi = GoCardlessApi.create({ context });
    const bank = await dbApi.getBank(bankId);

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
          bankId,
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

    return json({
      savedAccounts,
    });
  } catch (error) {
    console.error("Failed to sync accounts", error);
    throw new Response("An error happened", { status: 500 });
  }
}
