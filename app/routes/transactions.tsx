import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  json,
  redirect,
} from "@remix-run/cloudflare";
import { Form, useLoaderData, useNavigation } from "@remix-run/react";
import { eq } from "drizzle-orm";
import { TransactionSchema } from "generated-sources/gocardless";
import { Button } from "~/components/ui/button";
import { getDbFromContext } from "~/lib/db.service.server";
import { DbApi } from "~/lib/dbApi";
import { GoCardlessApi } from "~/lib/gocardless-api.server";
import {
  NewTransaction,
  Transaction,
  account as accountTable,
} from "~/lib/schema";

export async function loader({ context }: LoaderFunctionArgs) {
  const dbApi = DbApi.create({ context });

  const transactions = await dbApi.getTransactions();

  return json({ transactions });
}

function remoteToInternalTransaction({
  remote,
  status,
  userId,
  accountId,
  bankId,
}: {
  remote: TransactionSchema;
  status: "booked" | "pending";
  userId: number;
  accountId: string;
  bankId: string;
}): Transaction {
  return {
    userId,
    bankId,
    transactionId:
      remote.transactionId ??
      remote.internalTransactionId ??
      `${accountId} - ${userId}`,
    status,
    accountId,
    amount: remote.transactionAmount.amount,
    currency: remote.transactionAmount.currency,
    bookingDateTime: remote.bookingDateTime
      ? new Date(remote.bookingDateTime)
      : null,
    valueDateTime: remote.valueDateTime ? new Date(remote.valueDateTime) : null,
    creditorName: remote.creditorName ?? null,
    debtorName: remote.debtorName ?? null,
    categoryId: null,
    additionalInformation: remote.additionalInformation ?? null,
    debtorBban: remote.debtorAccount?.bban ?? null,
    creditorBban: remote.creditorAccount?.bban ?? null,
    exchangeRate: remote.currencyExchange?.[0]?.exchangeRate ?? null,
  };
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
      <Form method="POST">
        <Button disabled={isNavigating}>Sync transactions</Button>
      </Form>
      <h1>Transactions</h1>
      <ul>
        {transactions.map((it) => (
          <li key={it.transactionId}>
            {Object.entries(it).map(([key, value]) => (
              <span key={key}>
                {key}: {value?.toString()} <br />
              </span>
            ))}
            {it.amount}
            {it.currency}
          </li>
        ))}
      </ul>
    </div>
  );
}
