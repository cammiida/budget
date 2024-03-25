import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { json, useFetcher, useLoaderData, useParams } from "@remix-run/react";
import { eq } from "drizzle-orm";
import { RefreshCw } from "lucide-react";
import { route } from "routes-gen";
import ActionHeader from "~/components/ui/action-header";
import { Button } from "~/components/ui/button";
import { requireUser } from "~/lib/auth.server";
import { getDbFromContext } from "~/lib/db.service.server";
import { accounts as accountsTable } from "~/lib/schema";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const user = requireUser(context);

  const db = getDbFromContext(context);
  const accounts = await db.query.accounts.findMany({
    where: eq(accountsTable.userId, user.id),
    columns: { name: true, ownerName: true, balances: true },
    with: { bank: true },
  });

  return json({ user, accounts });
}

export default function Accounts() {
  const { accounts } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const params = useParams();
  const isNavigating = fetcher.state !== "idle";

  return (
    <>
      <ActionHeader title="Accounts">
        <fetcher.Form method="POST" action={route("/api/sync-accounts")}>
          <input type="hidden" name="bankId" value={params.bankId} />
          <Button
            variant="outline"
            disabled={isNavigating}
            className="flex gap-2"
          >
            <RefreshCw
              className={`h-4 w-4 ${isNavigating && "animate-spin"}`}
            />
            Sync accounts
          </Button>
        </fetcher.Form>
      </ActionHeader>
      <div className="relative top-16 px-6 py-8">
        <div className="w-1/2 min-w-fit rounded-md bg-white px-6 py-8 shadow-sm">
          <ul className="flex w-full min-w-[400px] flex-col gap-4">
            {accounts.map((account) => {
              const balance = account.balances.find(
                (balance) => balance.balanceType === "interimAvailable",
              );

              return (
                <li
                  key={account.name}
                  className="flex min-w-full cursor-pointer flex-col gap-1 rounded-md p-4"
                >
                  <div className="itemx-center flex w-full justify-between gap-8">
                    <div className="flex items-center gap-3">
                      <img
                        className="h-8 w-8 rounded-full"
                        src={account.bank.logo ?? undefined}
                        alt={account.bank.name}
                      />
                      <div>
                        <h2 className="text-md">
                          {/* splits on last , */}
                          {account.name?.split(/,(?=[^,]+$)/)[0]}
                        </h2>
                        <small>{account.ownerName}</small>
                      </div>
                    </div>
                    <span className="text-sm">
                      {balance?.balanceAmount.currency}{" "}
                      {balance?.balanceAmount.amount}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </>
  );
}
