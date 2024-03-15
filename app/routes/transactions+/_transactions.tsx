import type {
  ActionFunctionArgs,
  AppLoadContext,
  LoaderFunctionArgs,
  SerializeFrom,
} from "@remix-run/cloudflare";
import { json, redirect } from "@remix-run/cloudflare";
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
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  addMonths,
  endOfDay,
  formatISO9075,
  isBefore,
  startOfDay,
} from "date-fns";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { route } from "routes-gen";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import { DataTable } from "~/components/ui/data-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { getDbFromContext } from "~/lib/db.service.server";
import { DbApi } from "~/lib/dbApi";
import { GoCardlessApi } from "~/lib/gocardless-api.server";
import type { NewTransaction } from "~/lib/schema";
import { category, transaction as transactionTable } from "~/lib/schema";
import { formatDate, transformRemoteTransactions } from "~/lib/utils";

export const transactionStringSchema = z.string().transform((arg) => {
  if (!arg) return [];

  return z
    .object({
      transactionId: z.string(),
      categoryId: z.number().nullable(),
    })
    .array()
    .parse(JSON.parse(arg));
});

const PAGE_SIZE = 10;

export async function loader({ context, request }: LoaderFunctionArgs) {
  const dbApi = DbApi.create({ context });
  const userId = context.user?.id;

  if (!userId) {
    return redirect("/auth/login", { status: 401 });
  }

  const searchParams = new URL(request.url).searchParams;

  const { from, to } = verifyAndSetDateSearchParams(searchParams);

  const whereClause = and(
    eq(transactionTable.userId, userId),
    gte(transactionTable.valueDate, from),
    lte(transactionTable.valueDate, to),
  );

  const db = getDbFromContext(context);
  const [{ transactionCount }] = await db
    .select({ transactionCount: sql<number>`count(*)` })
    .from(transactionTable)
    .where(whereClause);

  const totalPages =
    transactionCount > 0 ? Math.ceil(transactionCount / PAGE_SIZE) : 1;
  const page = verifyAndSetPageSearchParams({ totalPages, searchParams });
  const offset = (page - 1) * PAGE_SIZE;

  const allCategories = await db.query.category.findMany({
    columns: { name: true, id: true, keywords: true },
    where: eq(category.userId, userId),
  });

  const transactions = await db.query.transaction.findMany({
    where: whereClause,
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

  const lastSavedTransactionDate = toLocaleDateString(
    (await dbApi.getLatestTransactionDate())?.date ?? new Date(),
  );

  return json({
    transactions: {
      entries: transactions,
      offset,
      totalPages,
      limit: PAGE_SIZE,
      totalCount: transactionCount,
    },
    lastSavedTransactionDate,
    categories: allCategories,
  });
}

type SyncTransactionsArgs = {
  formData: FormData;
  context: AppLoadContext;
  userId: number;
};

async function syncTransactions({
  formData,
  context,
  userId,
}: SyncTransactionsArgs) {
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

  const transformedTransactions: NewTransaction[] = transformRemoteTransactions(
    remoteTransactions,
    userId,
  );

  const savedTransactions = await dbApi.saveTransactions(
    transformedTransactions,
  );

  return json({ success: true, transactions: savedTransactions });
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
    const transactions = transactionStringSchema.parse(
      formData.get("transactions"),
    );

    const dbApi = DbApi.create({ context });
    const updatedTransactions =
      await dbApi.updateTransactionCategories(transactions);

    return json({ success: true, transactions: updatedTransactions });
  }

  return json({ success: false }, { status: 400 });
}

export default function Transactions() {
  const { transactions, lastSavedTransactionDate, categories } =
    useLoaderData<typeof loader>();
  const actionData = useActionData() as { success: boolean } | undefined;

  const navigate = useNavigate();
  const navigation = useNavigation();

  const isNavigating = navigation.state !== "idle";
  const [searchParams, setSearchParams] = useSearchParams();

  const currentPage = pageSchema.parse(searchParams.get("page")) ?? 1;
  const canGoBack = !!currentPage && currentPage > 1;
  const canGoForward = !currentPage || currentPage < transactions.totalPages;

  function setPage(page: number) {
    setSearchParams(
      (prev) => {
        prev.set("page", page.toString());
        return prev;
      },
      { preventScrollReset: true },
    );
  }

  const columns: ColumnDef<ClientTransaction>[] = [
    {
      accessorKey: "bank.name",
      header: "Bank",
      cell: ({ row }) => {
        const bank = row.original.bank;
        return (
          <>
            <img
              className="h-8 w-8 rounded-full"
              src={bank?.logo ?? undefined}
              alt={bank?.name}
            />
            <span>{bank?.name}</span>
          </>
        );
      },
    },
    {
      accessorKey: "account.accountId",
      header: "Account",
      cell: ({ row }) => {
        const account = row.original.account;
        return (
          <>
            <small>{account?.bban}</small>
            <br />
            {account?.name.split(",").slice(0, -1).join(", ")}
          </>
        );
      },
    },
    {
      accessorKey: "valueDate",
      header: "Date",
      cell: ({ row }) => {
        const transaction = row.original;
        const date = transaction.valueDate ?? transaction.bookingDate;
        return <span>{date && formatDate(date)}</span>;
      },
    },
    { accessorKey: "additionalInformation", header: "Details" },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ row }) => {
        const transaction = row.original;
        return `${transaction.amount} ${transaction.currency}`;
      },
    },
    {
      accessorKey: "category.name",
      header: "Category",
      cell: ({ row }) => (
        <SelectCategory categories={categories} transaction={row.original} />
      ),
    },
  ];

  const table = useReactTable({
    data: transactions.entries,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

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
            onClick={() => setPage(1)}
          >
            {"<<"}
          </Button>
          <Button
            variant="secondary"
            disabled={!canGoBack}
            onClick={() => setPage(currentPage - 1)}
          >
            {"<"}
          </Button>
          <span>{searchParams.get("page") ?? 1}</span>
          <Button
            variant="secondary"
            disabled={!canGoForward}
            onClick={() => setPage(currentPage + 1)}
          >
            {">"}
          </Button>
          <Button
            variant="secondary"
            disabled={!canGoForward}
            onClick={() => setPage(transactions.totalPages)}
          >
            {">>"}
          </Button>
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
                hidden
                name="fromDate"
                value={lastSavedTransactionDate}
              />
            )}
            <input readOnly hidden name="intent" value="sync" />
            <Button disabled={isNavigating}>Sync transactions</Button>
          </Form>
        </div>
      </div>
      <DataTable table={table} />
    </div>
  );
}

export type Loader = typeof loader;
type ClientTransaction = SerializeFrom<Loader>["transactions"]["entries"][0];
type ClientCategory = SerializeFrom<Loader>["categories"][0];

function SelectCategory({
  transaction,
  categories,
}: {
  transaction: ClientTransaction;
  categories: ClientCategory[];
}) {
  const submit = useSubmit();
  const category = transaction.category;

  return (
    <Select
      onValueChange={(value) => {
        const formData = new FormData();
        formData.append("intent", "saveCategories");
        formData.append(
          "transactions",
          JSON.stringify([
            {
              transactionId: transaction.transactionId,
              categoryId: value && value !== "null" ? parseInt(value) : null,
            },
          ]),
        );
        return submit(formData, { method: "POST" });
      }}
    >
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder={category?.name} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="null">-</SelectItem>
        {categories.map((category) => (
          <SelectItem key={category.id} value={category.id.toString()}>
            {category.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function toLocaleDateString(date: Date) {
  return formatISO9075(date, { representation: "date" });
}

// TODO: zodify
function verifyAndSetDateSearchParams(searchParams: URLSearchParams): {
  from: Date;
  to: Date;
} {
  const fromDateSearchParam = searchParams.get("from");
  const toDateSearchParam = searchParams.get("to");
  const fromDate = fromDateSearchParam
    ? startOfDay(new Date(fromDateSearchParam))
    : undefined;
  const toDate = toDateSearchParam
    ? endOfDay(new Date(toDateSearchParam))
    : undefined;

  if (!fromDate || !toDate) {
    const from = fromDate ?? startOfDay(new Date(addMonths(new Date(), -1)));
    const to = toDate ?? endOfDay(new Date(addMonths(from, 1)));

    searchParams.set("from", toLocaleDateString(from));
    searchParams.set("to", toLocaleDateString(to));

    throw redirect("/transactions?" + searchParams.toString());
  }

  if (isBefore(toDate, fromDate)) {
    searchParams.set(
      "to",
      toLocaleDateString(endOfDay(addMonths(fromDate, 1))),
    );
    throw redirect("/transactions?" + searchParams.toString());
  }

  return { from: fromDate, to: toDate };
}

const pageSchema = z
  .string()
  .transform((arg) => parseInt(arg))
  .nullable();

function verifyAndSetPageSearchParams({
  totalPages,
  searchParams,
}: {
  totalPages: number;
  searchParams: URLSearchParams;
}): number {
  const page = pageSchema.parse(searchParams.get("page")) ?? 1;

  if (page < 1) {
    searchParams.delete("page");
    throw redirect("/transactions?" + searchParams.toString());
  } else if (page > totalPages) {
    searchParams.set("page", totalPages.toString());
    throw redirect("/transactions?" + searchParams.toString());
  }

  return page;
}
