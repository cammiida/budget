import { LoaderFunctionArgs, json } from "@remix-run/cloudflare";
import { Outlet, useFetcher, useLoaderData, useParams } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import { DbApi } from "~/lib/dbApi";

export async function loader(args: LoaderFunctionArgs) {
  const bankId = args.params.bankId;

  if (!bankId) {
    // TODO: throw error and show error boundary?
    return json({ bank: null, accounts: [] });
  }

  const api = DbApi.create(args);
  const [bank, accounts] = await Promise.all([
    api.getBank(bankId),
    api.getAllAccounts(bankId),
  ]);

  return json({ bank, accounts });
}

export default function Bank() {
  const { bank, accounts } = useLoaderData<typeof loader>();
  const params = useParams();

  const fetcher = useFetcher();

  return (
    <div className="flex flex-col gap-4 items-center">
      <fetcher.Form method="POST" action="/api/sync-accounts">
        <input type="hidden" name="bankId" value={params.bankId} />
        <Button type="submit" disabled={fetcher.state !== "idle"}>
          Sync accounts
        </Button>
      </fetcher.Form>
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
              {params.accountId === account.accountId && <Outlet />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
