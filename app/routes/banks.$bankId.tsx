import { LoaderFunctionArgs, json } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import { BalanceSchema, DetailSchema } from "generated-sources/gocardless";
import { GoCardlessApi } from "~/lib/gocardless-api.server";

type ServerAccount = {
  accountId: string;
  balances: BalanceSchema[];
} & DetailSchema;

export async function loader(args: LoaderFunctionArgs) {
  const bankId = args.params.bankId;

  if (!bankId) {
    // TODO: throw error and show error boundary?
    return json({ bank: null, accounts: [] });
  }

  const goCardlessApi = await GoCardlessApi.create(args);
  const chosenBanks = await goCardlessApi.getChosenBanks();

  // TODO: api call to get bank by id
  const bank = chosenBanks.find((it) => it.id === bankId);

  if (!bank) {
    throw new Response("Bank not found", { status: 404 });
  }

  const requisition = await goCardlessApi.getRequisition(bankId);

  if (!requisition) {
    throw new Response("Requisition not found", { status: 404 });
  }

  async function getAccountDetails(accountId: string): Promise<ServerAccount> {
    const [accountDetails, accountBalances] = await Promise.all([
      goCardlessApi.getAccountDetails(accountId),
      goCardlessApi.getAccountBalances(accountId),
    ]);

    return {
      accountId,
      ...accountDetails.account,
      balances: accountBalances.balances ?? [],
    };
  }

  const accounts: ServerAccount[] = await Promise.all(
    requisition.accounts?.map(getAccountDetails) ?? []
  );

  return json({ bank, requisition, accounts });
}

export default function Bank() {
  const { bank, accounts } = useLoaderData<typeof loader>();

  return (
    <div className="flex flex-col gap-4 items-center">
      <h1 className="text-xl">{bank?.name}</h1>
      <ul className="flex flex-col gap-4 max-w-lg min-w-[400px]">
        {accounts.map((account) => {
          const balance = account.balances.find(
            (balance) => balance.balanceType === "interimAvailable"
          );

          return (
            <li
              key={account.accountId}
              className="flex flex-col gap-1 min-w-full shadow-lg p-4 rounded-md cursor-pointer bg-slate-100"
            >
              <div className="w-full flex justify-between">
                <h2 className="text-lg">
                  {/* splits on last , */}
                  {account.name?.split(/\,(?=[^\,]+$)/)[0]}
                </h2>
                <h3 className="text-lg">
                  ({balance?.balanceAmount.currency}
                  {balance?.balanceAmount.amount})
                </h3>
              </div>
              <small>{account.ownerName}</small>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
