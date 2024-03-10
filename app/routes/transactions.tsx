import {
  ActionFunctionArgs,
  AppLoadContext,
  LoaderFunctionArgs,
  SerializeFrom,
  json,
  redirect,
} from "@remix-run/cloudflare";
import {
  Form,
  Outlet,
  useActionData,
  useLoaderData,
  useNavigate,
  useNavigation,
  useSearchParams,
  useSubmit,
} from "@remix-run/react";
import { and, desc, eq, sql } from "drizzle-orm";
import { useState } from "react";
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

const PAGE_SIZE = 10;

const pageSchema = z
  .string()
  .transform((arg) => parseInt(arg))
  .nullable();

export async function loader({ context, request }: LoaderFunctionArgs) {
  const dbApi = DbApi.create({ context });
  const userId = context.user?.id;
  if (!userId) {
    return redirect("/auth/login", { status: 401 });
  }

  const searchParams = new URL(request.url).searchParams;
  const page = pageSchema.parse(searchParams.get("page")) ?? 1;

  const db = getDbFromContext(context);
  const [{ transactionCount }] = await db
    .select({ transactionCount: sql<number>`count(*)` })
    .from(transactionTable)
    .where(eq(transactionTable.userId, userId));

  const totalPages = Math.ceil(transactionCount / PAGE_SIZE);
  const offset = (page - 1) * PAGE_SIZE;

  if (page < 1) {
    searchParams.delete("page");
    return redirect("/transactions?" + searchParams.toString());
  } else if (page > totalPages) {
    searchParams.set("page", totalPages.toString());
    return redirect("/transactions?" + searchParams.toString());
  }

  const allCategories = await db.query.category.findMany({
    columns: { name: true, id: true, keywords: true },
    where: eq(category.userId, userId),
  });

  const transactions = await db.query.transaction.findMany({
    where: eq(transactionTable.userId, userId),
    orderBy: desc(transactionTable.valueDate),
    limit: PAGE_SIZE,
    offset,
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
      category: { columns: { id: true, name: true, keywords: true } },
    },
  });

  const transactionsWithSuggestedCategory = transactions.map((transaction) => {
    const suggestedCategory = allCategories.find((category) =>
      category.keywords?.some((keyword) =>
        transaction.additionalInformation
          ?.toLocaleLowerCase()
          .includes(keyword.toLocaleLowerCase()),
      ),
    );

    return { ...transaction, suggestedCategory };
  });

  const lastSavedTransactionDate = (
    await dbApi.getLatestTransactionDate()
  )?.date
    ?.toISOString()
    .split("T")[0];

  const initialSelectedTransactions = transactionsWithSuggestedCategory.map(
    (it) => ({
      transactionId: it.transactionId,
      categoryId: it.suggestedCategory?.id ?? null,
      selected: !it.category && !!it.suggestedCategory,
    }),
  );

  return json({
    transactions: {
      entries: transactionsWithSuggestedCategory,
      offset,
      totalPages,
      limit: PAGE_SIZE,
      totalCount: transactionCount,
    },
    lastSavedTransactionDate,
    categories: allCategories,
    initialSelectedTransactions,
  });
}

async function syncTransactions({
  formData,
  context,
  userId,
}: {
  formData: FormData;
  context: AppLoadContext;
  userId: number;
}) {
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
          userId,
          accountId,
          bankId,
        }),
      );

      const bookedTransactions = booked.flatMap((it) =>
        remoteToInternalTransaction({
          remote: it,
          status: "booked",
          userId,
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

  return json({ success: true, transactions: savedTransactions });
}

async function saveCategories({
  formData,
  context,
  userId,
}: {
  formData: FormData;
  context: AppLoadContext;
  userId: number;
}) {
  const transactions = z
    .string()
    .transform((arg) =>
      z
        .object({
          transactionId: z.string(),
          categoryId: z.number().nullable(),
        })
        .array()
        .parse(JSON.parse(arg)),
    )
    .parse(formData.get("transactions"));

  const db = getDbFromContext(context);

  const updatedTransactions = await Promise.all(
    transactions.map((transaction) =>
      db
        .update(transactionTable)
        .set({ categoryId: transaction.categoryId })
        .where(
          and(
            eq(transactionTable.transactionId, transaction.transactionId),
            eq(transactionTable.userId, userId),
          ),
        )
        .returning()
        .get(),
    ),
  );

  return json({ success: true, transactions: updatedTransactions });
}

export async function action({ request, context }: ActionFunctionArgs) {
  const user = context.user;
  if (!user) {
    return redirect("/auth/login", { status: 401 });
  }

  const formData = await request.formData();

  const intent = z
    .literal("sync")
    .or(z.literal("saveCategories"))
    .parse(formData.get("intent"));

  if (intent === "sync") {
    return syncTransactions({ formData, context, userId: user.id });
  } else if (intent === "saveCategories") {
    return saveCategories({ formData, context, userId: user.id });
  }

  return json({ success: false }, { status: 400 });
}

export default function Transactions() {
  const {
    transactions,
    lastSavedTransactionDate,
    initialSelectedTransactions,
  } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const isNavigating = navigation.state !== "idle";
  const [searchParams, setSearchParams] = useSearchParams();

  const currentPage = pageSchema.parse(searchParams.get("page")) ?? 1;
  const canGoBack = !!currentPage && currentPage > 1;
  const canGoForward = !currentPage || currentPage < transactions.totalPages;

  function changePage(direction: "back" | "forward") {
    const newPage = direction === "back" ? currentPage - 1 : currentPage + 1;
    setSearchParams(
      (prev) => {
        prev.set("page", newPage.toString());
        return prev;
      },
      { preventScrollReset: true },
    );
  }

  const actionData = useActionData() as { success: boolean } | undefined;

  const [selectedTransactions, setSelectedTransactions] = useState<
    (Pick<Transaction, "transactionId" | "categoryId"> & {
      selected: boolean;
    })[]
  >(initialSelectedTransactions);
  // TODO: mulitple suggested categories

  function toggleTransactionSelection(
    transactionId: string,
    selected: boolean,
  ) {
    setSelectedTransactions((prev) =>
      prev.map((it) => {
        if (it.transactionId === transactionId) {
          return { ...it, selected };
        }
        return it;
      }),
    );
  }

  return (
    <div className="relative">
      <Outlet />
      {!!actionData && !actionData.success && (
        <div className="absolute left-1/2 w-96 -translate-x-1/2 transform rounded-md border border-red-300 bg-red-200 px-8 py-4 text-center">
          Something went wrong 😬
        </div>
      )}
      <div className="mb-4 flex items-end justify-between">
        <h1 className="text-xl">Transactions</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            disabled={!canGoBack}
            onClick={() => {
              setSearchParams(
                (prev) => {
                  prev.set("page", "1");
                  return prev;
                },
                { preventScrollReset: true },
              );
            }}
          >
            {"<<"}
          </Button>
          <Button
            variant="secondary"
            disabled={!canGoBack}
            onClick={() => changePage("back")}
          >
            {"<"}
          </Button>
          <span>{searchParams.get("page") ?? 1}</span>
          <Button
            variant="secondary"
            disabled={!canGoForward}
            onClick={() => changePage("forward")}
          >
            {">"}
          </Button>
          <Button
            variant="secondary"
            disabled={!canGoForward}
            onClick={() => {
              setSearchParams(
                (prev) => {
                  prev.set("page", transactions.totalPages.toString());
                  return prev;
                },
                { preventScrollReset: true },
              );
            }}
          >
            {">>"}
          </Button>
          <Form method="POST" reloadDocument>
            <input
              readOnly
              hidden
              name="transactions"
              value={JSON.stringify(selectedTransactions)}
            />
            <input readOnly hidden name="intent" value="saveCategories" />
            <Button
              type="submit"
              disabled={
                !selectedTransactions.filter((it) => it.selected).length
              }
            >
              Save
            </Button>
          </Form>
          <Button
            onClick={() =>
              navigate(
                route("/transactions/suggest-categories") +
                  `?${searchParams.toString()}`,
              )
            }
          >
            Suggest categories
          </Button>
          <Form method="POST">
            {lastSavedTransactionDate && (
              <input
                readOnly
                type="hidden"
                name="fromDate"
                value={lastSavedTransactionDate}
              />
            )}
            <input readOnly hidden name="intent" value="sync" />
            <Button disabled={isNavigating}>Sync transactions</Button>
          </Form>
        </div>
      </div>
      <table className="w-full shadow-lg">
        <thead>
          <tr>
            <th className="rounded-tl-md bg-slate-100 p-4 text-left"></th>
            <th className="bg-slate-100 p-4 text-left">Bank</th>
            <th className="bg-slate-100 p-4 text-left">Account</th>
            <th className="bg-slate-100 p-4 text-left">Details</th>
            <th className="bg-slate-100 p-4 text-left">Amount</th>
            <th className="bg-slate-100 p-4 text-left">Category</th>
            <th className="rounded-tr-md bg-slate-100 p-4 text-left">
              Suggested category
            </th>
          </tr>
        </thead>
        <tbody>
          {transactions.entries.map((it) => {
            return (
              <TransactionRow
                key={it.transactionId}
                transaction={it}
                toggleTransactionSelection={toggleTransactionSelection}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TransactionRow({
  transaction: aggregatedTrans,
  toggleTransactionSelection,
}: {
  transaction: ClientTransaction;
  toggleTransactionSelection: (
    transactionId: string,
    selected: boolean,
  ) => void;
}) {
  const { bank, account, category, ...transaction } = aggregatedTrans;
  const { categories } = useLoaderData<typeof loader>();

  const date = transaction.valueDate ?? transaction.bookingDate;

  const submit = useSubmit();

  return (
    <tr className="border border-slate-100">
      <DataCell>
        {transaction.suggestedCategory && (
          <input
            type="checkbox"
            disabled={!transaction.suggestedCategory}
            defaultChecked={!category && !!transaction.suggestedCategory}
            onChange={(e) =>
              transaction.suggestedCategory &&
              toggleTransactionSelection(
                transaction.transactionId,
                e.currentTarget.checked,
              )
            }
          />
        )}
      </DataCell>
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
        <Form method="POST">
          <select
            defaultValue={category?.id}
            onChange={(event) => {
              toggleTransactionSelection(
                transaction.transactionId,
                !!transaction.suggestedCategory &&
                  event.currentTarget.value === "",
              );

              const formData = new FormData();
              formData.append("intent", "saveCategories");
              formData.append(
                "transactions",
                JSON.stringify([
                  {
                    transactionId: transaction.transactionId,
                    categoryId: event.currentTarget.value
                      ? parseInt(event.currentTarget.value)
                      : null,
                  },
                ]),
              );
              return submit(formData, { method: "POST" });
            }}
          >
            <option value=""></option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </Form>
      </DataCell>
      <DataCell>{transaction.suggestedCategory?.name ?? ""}</DataCell>
    </tr>
  );
}

function DataCell({ children }: { children: React.ReactNode }) {
  return <td className="p-4">{children}</td>;
}

type Loader = typeof loader;
type ClientTransaction = SerializeFrom<Loader>["transactions"]["entries"][0];
