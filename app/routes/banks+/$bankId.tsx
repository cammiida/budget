import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { json } from "@remix-run/cloudflare";
import { Outlet, useFetcher, useLoaderData, useParams } from "@remix-run/react";
import { route } from "routes-gen";
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
    api.getAccountsForBanks([bankId]),
  ]);

  return json({ bank, accounts });
}

export default function Bank() {
  const { bank, accounts } = useLoaderData<typeof loader>();
  const params = useParams();

  const fetcher = useFetcher();

  return (
    <div className="flex flex-col items-center gap-4">
      <fetcher.Form method="POST" action={route("/api/sync-accounts")}>
        <input type="hidden" name="bankId" value={params.bankId} />
        <Button type="submit" disabled={fetcher.state !== "idle"}>
          Sync accounts
        </Button>
      </fetcher.Form>
      <h1 className="text-xl">{bank?.name}</h1>
      <ul className="flex min-w-[400px] max-w-lg flex-col gap-4">
        {accounts.map((account) => {
          const balance = account.balances.find(
            (balance) => balance.balanceType === "interimAvailable",
          );

          return (
            <li
              key={account.accountId}
              className="flex min-w-full cursor-pointer flex-col gap-1 rounded-md bg-slate-100 p-4 shadow-lg"
            >
              <div className="flex w-full justify-between">
                <h2 className="text-lg">
                  {/* splits on last , */}
                  {account.name?.split(/,(?=[^,]+$)/)[0]}
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
