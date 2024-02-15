import { LoaderArgs, json } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import { GoCardlessApi } from "~/lib/gocardless-api.server";

export async function loader(args: LoaderArgs) {
  const bankId = args.params.bankId;

  if (!bankId) {
    // TODO: throw error and show error boundary?
    return json({ bank: null, accounts: [] });
  }

  const goCardlessApi = await GoCardlessApi.create(args);
  const chosenBanks = await goCardlessApi.getChosenBanks();

  // TODO: api call to get bank by id
  const bank = chosenBanks.find((it) => it.id === bankId);

  const requisition = await goCardlessApi.getRequisition(bankId);

  const accounts = !requisition.accounts
    ? []
    : await Promise.all(
        requisition.accounts.map(async (accountId) => ({
          accountId,
          balances:
            (await goCardlessApi.getAccountBalances(accountId)).balances ?? [],
        }))
      );

  return json({ bank, requisition, accounts });
}

export default function Bank() {
  const { bank, accounts } = useLoaderData<typeof loader>();

  return (
    <div>
      <h1>{bank?.name}</h1>
      <ul className="flex flex-col gap-4">
        {accounts?.map((account) => (
          <li key={account.accountId}>
            <h2 className="text-lg">Account {account.accountId}</h2>
            <ul>
              {account.balances.map((balance) => (
                <li key={balance.balanceType}>
                  <h3>
                    {balance.balanceType}: {balance.balanceAmount.amount}{" "}
                    {balance.balanceAmount.currency}
                  </h3>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
