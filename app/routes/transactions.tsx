import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  json,
  redirect,
} from "@remix-run/cloudflare";
import { Form, useLoaderData, useNavigation } from "@remix-run/react";
import { eq } from "drizzle-orm";
import { Button } from "~/components/ui/button";
import { getDbFromContext } from "~/lib/db.service.server";
import { DbApi } from "~/lib/dbApi";
import { GoCardlessApi } from "~/lib/gocardless-api.server";
import {
  NewTransaction,
  Transaction,
  account as accountTable,
} from "~/lib/schema";
import { formatDate, remoteToInternalTransaction } from "~/lib/utils";

export async function loader({ context }: LoaderFunctionArgs) {
  const dbApi = DbApi.create({ context });

  const transactions = await dbApi.getTransactions();

  return json({ transactions });
}

export async function action({ context }: ActionFunctionArgs) {
  const dbApi = DbApi.create({ context });

  const user = context.user;
  if (!user) {
    return redirect("/auth/login", { status: 401 });
  }
  const db = getDbFromContext(context);
  const goCardlessApi = GoCardlessApi.create({ context });
  const allAccounts = await db
    .select()
    .from(accountTable)
    .where(eq(accountTable.userId, user.id))
    .all();

  const res = await Promise.all(
    allAccounts.flatMap(({ accountId, bankId }) =>
      goCardlessApi
        .getAccountTransactions(accountId)
        .then((res) => ({ ...res.transactions, bankId, accountId }))
    )
  );

  const newTransactions: NewTransaction[] = res.flatMap(
    ({ pending, booked, accountId, bankId }) => {
      const pendingTransactions = (pending ?? []).flatMap((it) =>
        remoteToInternalTransaction({
          remote: it,
          status: "pending",
          userId: user.id,
          accountId,
          bankId,
        })
      );

      const bookedTransactions = booked.flatMap((it) =>
        remoteToInternalTransaction({
          remote: it,
          status: "booked",
          userId: user.id,
          accountId,
          bankId,
        })
      );
      return [...pendingTransactions, ...bookedTransactions];
    }
  );

  let savedTransactions: Transaction[] = [];
  const limit = 5;
  for (let start = 0; start < newTransactions.length; start += limit) {
    const end =
      start + limit > newTransactions.length
        ? newTransactions.length
        : start + limit;

    const slicedResults = await dbApi.saveTransactions(
      newTransactions.slice(start, end)
    );

    savedTransactions = [...savedTransactions, ...slicedResults];
  }

  return json({ transactions: savedTransactions });
}

export default function Transactions() {
  const { transactions } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isNavigating = navigation.state !== "idle";

  return (
    <div>
      <div className="flex justify-between items-end mb-4">
        <h1 className="text-xl">Transactions</h1>
        <Form method="POST">
          <Button disabled={isNavigating}>Sync transactions</Button>
        </Form>
      </div>
      <ul className="shadow-lg">
        {transactions.map((it) => {
          const date = it.valueDate ?? it.bookingDate;
          return (
            <li
              key={it.transactionId}
              className="flex justify-between items-end border border-slate-100 p-4"
            >
              <div className="flex flex-col">
                {date && <small>{formatDate(date)}</small>}
                {it.additionalInformation}
              </div>
              <div>
                {it.amount} {it.currency}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
