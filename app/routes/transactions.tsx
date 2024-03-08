import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  json,
  redirect,
} from "@remix-run/cloudflare";
import { Form, useLoaderData, useNavigation } from "@remix-run/react";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import { DbApi } from "~/lib/dbApi";
import { GoCardlessApi } from "~/lib/gocardless-api.server";
import { NewTransaction, Transaction } from "~/lib/schema";
import { formatDate, remoteToInternalTransaction } from "~/lib/utils";

export async function loader({ context }: LoaderFunctionArgs) {
  const dbApi = DbApi.create({ context });

  const transactions = await dbApi.getTransactions();
  const lastSavedTransactionDate = (
    await dbApi.getLatestTransactionDate()
  )?.date
    ?.toISOString()
    .split("T")[0];

  return json({ transactions, lastSavedTransactionDate });
}

export async function action({ request, context }: ActionFunctionArgs) {
  const user = context.user;
  if (!user) {
    return redirect("/auth/login", { status: 401 });
  }

  const formData = await request.formData();
  const fromDate =
    z.string().nullish().parse(formData.get("fromDate")) ?? undefined;

  const dbApi = DbApi.create({ context });
  const goCardlessApi = GoCardlessApi.create({ context });

  const accounts = await dbApi.getAccounts();

  const remoteTransactions = await Promise.all(
    accounts.flatMap(({ accountId, bankId }) =>
      goCardlessApi
        .getAccountTransactions(accountId, fromDate)
        .then((res) => ({ ...res.transactions, bankId, accountId })),
    ),
  );

  const transformedTransactions: NewTransaction[] = remoteTransactions.flatMap(
    ({ pending, booked, accountId, bankId }) => {
      const pendingTransactions = (pending ?? []).flatMap((it) =>
        remoteToInternalTransaction({
          remote: it,
          status: "pending",
          userId: user.id,
          accountId,
          bankId,
        }),
      );

      const bookedTransactions = booked.flatMap((it) =>
        remoteToInternalTransaction({
          remote: it,
          status: "booked",
          userId: user.id,
          accountId,
          bankId,
        }),
      );
      return [...pendingTransactions, ...bookedTransactions];
    },
  );

  let savedTransactions: Transaction[] = [];
  const limit = 5;
  for (let start = 0; start < transformedTransactions.length; start += limit) {
    const end =
      start + limit > transformedTransactions.length
        ? transformedTransactions.length
        : start + limit;

    const slicedResults = await dbApi.saveTransactions(
      transformedTransactions.slice(start, end),
    );

    savedTransactions = [...savedTransactions, ...slicedResults];
  }

  return json({ transactions: savedTransactions });
}

export default function Transactions() {
  const { transactions, lastSavedTransactionDate } =
    useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isNavigating = navigation.state !== "idle";

  return (
    <div>
      <div className="mb-4 flex items-end justify-between">
        <h1 className="text-xl">Transactions</h1>
        <Form method="POST">
          {lastSavedTransactionDate && (
            <input
              readOnly
              type="hidden"
              name="fromDate"
              value={lastSavedTransactionDate}
            />
          )}
          <Button disabled={isNavigating}>Sync transactions</Button>
        </Form>
      </div>
      <ul className="shadow-lg">
        {transactions.map((it) => {
          const date = it.valueDate ?? it.bookingDate;
          return (
            <li
              key={it.transactionId}
              className="flex items-end justify-between border border-slate-100 p-4"
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
