import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  SerializeFrom,
  json,
  redirect,
} from "@remix-run/cloudflare";
import {
  Form,
  useFetcher,
  useLoaderData,
  useNavigation,
} from "@remix-run/react";
import { desc, eq } from "drizzle-orm";
import { route } from "routes-gen";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import { getDbFromContext } from "~/lib/db.service.server";
import { DbApi } from "~/lib/dbApi";
import { GoCardlessApi } from "~/lib/gocardless-api.server";
import {
  NewTransaction,
  Transaction,
  category,
  transaction as transactionTable,
} from "~/lib/schema";
import { formatDate, remoteToInternalTransaction } from "~/lib/utils";

export async function loader({ context }: LoaderFunctionArgs) {
  const dbApi = DbApi.create({ context });
  const userId = context.user?.id;

  if (!userId) {
    return redirect("/auth/login", { status: 401 });
  }

  const db = getDbFromContext(context);
  const transactions = await db.query.transaction.findMany({
    where: eq(transactionTable.userId, userId),
    orderBy: desc(transactionTable.valueDate),
    columns: {
      additionalInformation: true,
      amount: true,
      bookingDate: true,
      valueDate: true,
      currency: true,
      transactionId: true,
    },
    with: {
      account: { columns: { bban: true, accountId: true, name: true } },
      bank: { columns: { logo: true, name: true } },
      category: { columns: { id: true, name: true } },
    },
  });

  const categories = await db.query.category.findMany({
    columns: { name: true, id: true },
    where: eq(category.userId, userId),
  });

  const lastSavedTransactionDate = (
    await dbApi.getLatestTransactionDate()
  )?.date
    ?.toISOString()
    .split("T")[0];

  return json({
    transactions,
    lastSavedTransactionDate,
    categories,
  });
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
  const { transactions, lastSavedTransactionDate, categories } =
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
      <table className="w-full shadow-lg">
        <tr>
          <th className="rounded-tl-md bg-slate-100 p-4 text-left">Bank</th>
          <th className="bg-slate-100 p-4 text-left">Account</th>
          <th className="bg-slate-100 p-4 text-left">Details</th>
          <th className="bg-slate-100 p-4 text-left">Amount</th>
          <th className="rounded-tr-md bg-slate-100 p-4 text-left">Category</th>
        </tr>
        {transactions.map((it) => {
          return <TransactionRow key={it.transactionId} transaction={it} />;
        })}
      </table>
    </div>
  );
}

type ClientTransaction = SerializeFrom<typeof loader>["transactions"][0];

function TransactionRow({
  transaction: aggregatedTrans,
}: {
  transaction: ClientTransaction;
}) {
  const { bank, account, category, ...transaction } = aggregatedTrans;
  const { categories } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  const date = transaction.valueDate ?? transaction.bookingDate;

  return (
    <tr className="border border-slate-100">
      <DataCell>
        <img
          className="h-8 w-8 rounded-full"
          src={bank.logo ?? undefined}
          alt={bank.name}
        />
        {bank.name}
      </DataCell>
      <DataCell>
        <small>{account.bban}</small>
        <br />
        {account.name.split(",").slice(0, -1).join(", ")}
      </DataCell>
      <DataCell>
        {date && <small>{formatDate(date)}</small>}
        <br />
        {transaction.additionalInformation}
      </DataCell>
      <DataCell>
        {transaction.amount} {transaction.currency}
      </DataCell>
      <DataCell>
        <fetcher.Form
          method="POST"
          action={route("/api/set-transaction-category")}
        >
          <input
            type="hidden"
            name="transactionId"
            value={transaction.transactionId}
          />
          <select
            name="categoryId"
            defaultValue={category?.id}
            onChange={(event) => {
              return fetcher.submit(event.currentTarget.form, {
                method: "POST",
                action: route("/api/set-transaction-category"),
              });
            }}
          >
            <option value="">Select category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </fetcher.Form>
      </DataCell>
    </tr>
  );
}

function DataCell({ children }: { children: React.ReactNode }) {
  return <td className="p-4">{children}</td>;
}
