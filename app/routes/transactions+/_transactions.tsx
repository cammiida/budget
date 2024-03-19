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
  useSubmit,
} from "@remix-run/react";
import type { Column, ColumnDef } from "@tanstack/react-table";
import {
  filterFns,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { formatISO9075 } from "date-fns";
import { and, desc, eq } from "drizzle-orm";
import { route } from "routes-gen";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { DataTable, SortableHeaderCell } from "~/components/ui/data-table";
import { DataTableFilter } from "~/components/ui/data-table-filter";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { LargeText } from "~/components/ui/typography";
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

export async function loader({ context }: LoaderFunctionArgs) {
  const dbApi = DbApi.create({ context });
  const userId = context.user?.id;

  if (!userId) {
    return redirect("/auth/login", { status: 401 });
  }

  const db = getDbFromContext(context);
  const allCategories = await db.query.category.findMany({
    columns: { name: true, id: true, keywords: true },
    where: eq(category.userId, userId),
  });

  const transactions = await db.query.transaction.findMany({
    where: and(eq(transactionTable.userId, userId)),
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
      category: { columns: { id: true, name: true, keywords: true } },
    },
  });

  const lastSavedTransactionDate = toLocaleDateString(
    (await dbApi.getLatestTransactionDate())?.date ?? new Date(),
  );

  return json({
    transactions,
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

  const uniqueBanks = new Set(transactions.map((t) => t.bank.name));
  const uniqueAccountNames = new Set(
    transactions.map((t) => prettifyAccountName(t.account.name)),
  );

  filterFns.arrIncludesSome.autoRemove = () => false;

  const columns: ColumnDef<ClientTransaction>[] = [
    {
      id: "bank",
      accessorKey: "bank.name",
      header: (c) => <SortableHeaderCell context={c} name="Bank" />,
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
      filterFn: "arrIncludesSome",
    },
    {
      id: "account",
      accessorFn: (row) => prettifyAccountName(row.account?.name ?? ""),
      header: (c) => <SortableHeaderCell context={c} name="Account" />,
      cell: ({ row }) => {
        const account = row.original.account;
        return (
          <>
            <small>{account?.bban}</small>
            <br />
            {prettifyAccountName(account?.name ?? "")}
          </>
        );
      },
      filterFn: "arrIncludesSome",
    },
    {
      accessorKey: "valueDate",
      header: (c) => <SortableHeaderCell context={c} name="Date" />,
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
    data: transactions,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: {
      columnFilters: [
        { id: "bank", value: [...uniqueBanks] },
        { id: "account", value: [...uniqueAccountNames] },
      ],
    },
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
            onClick={() => navigate(route("/transactions/suggest-categories"))}
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

      <DataTable table={table} pagination>
        <DataTableFilter>
          <div className="relative flex flex-col gap-6 p-2">
            <CheckBoxFilterGroup
              header="Banks"
              column={table.getColumn("bank")}
              values={[...uniqueBanks]}
            />
            <CheckBoxFilterGroup
              header="Accounts"
              column={table.getColumn("account")}
              values={[...uniqueAccountNames]}
            />
          </div>
        </DataTableFilter>
      </DataTable>
    </div>
  );
}

export type Loader = typeof loader;
type ClientTransaction = SerializeFrom<Loader>["transactions"][0];
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

type CheckBoxFilterGroupProps<TData> = {
  header: string;
  column: Column<TData> | undefined;
  values: string[];
};

function CheckBoxFilterGroup<TData>(props: CheckBoxFilterGroupProps<TData>) {
  const { header, column, values } = props;

  return (
    <div className="flex flex-col gap-2">
      <LargeText>{header}</LargeText>
      <ul className="flex flex-col gap-2">
        {values.map((value) => {
          const filterValues = column?.getFilterValue() as string[] | undefined;
          const isChecked = !!filterValues?.includes(value);

          return (
            <div key={value} className="flex items-center space-x-2">
              <Checkbox
                id={value}
                checked={isChecked}
                onClick={() => {
                  const newFilterValue = isChecked
                    ? filterValues?.filter((v) => v !== value) ?? []
                    : [...new Set([...(filterValues ?? []), value])];

                  column?.setFilterValue(newFilterValue);
                }}
              />
              <Label htmlFor="terms">{value}</Label>
            </div>
          );
        })}
      </ul>
    </div>
  );
}

function toLocaleDateString(date: Date) {
  return formatISO9075(date, { representation: "date" });
}

function prettifyAccountName(name: string) {
  const split = name.split(",");
  if (split.length === 1) return name;

  return split.slice(0, -1).join(", ");
}
