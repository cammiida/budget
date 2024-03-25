import type {
  ActionFunctionArgs,
  AppLoadContext,
  LoaderFunctionArgs,
  SerializeFrom,
} from "@remix-run/cloudflare";
import { json } from "@remix-run/cloudflare";
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
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { formatISO9075 } from "date-fns";
import { and, desc, eq } from "drizzle-orm";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { route } from "routes-gen";
import { z } from "zod";
import ActionHeader from "~/components/ui/action-header";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { DataTable, SortableHeaderCell } from "~/components/ui/data-table";
import { DataTableFilter } from "~/components/ui/data-table-filter";
import { DataTablePagination } from "~/components/ui/data-table-pagination";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { LargeText } from "~/components/ui/typography";
import { requireUser } from "~/lib/auth.server";
import type { Intent } from "~/lib/constants";
import { INTENTS, SPENDING_TYPES, WANT_OR_NEED } from "~/lib/constants";
import { getDbFromContext } from "~/lib/db.service.server";
import { DbApi } from "~/lib/dbApi";
import { GoCardlessApi } from "~/lib/gocardless-api.server";
import type { NewTransaction } from "~/lib/schema";
import {
  bankTransactions,
  categories,
  bankTransactions as transactionTable,
} from "~/lib/schema";
import {
  formatDate,
  getZodEnumFromObjectKeys,
  prettifyAccountName,
  transformRemoteTransactions,
} from "~/lib/utils";

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
  const user = requireUser(context);

  const db = getDbFromContext(context);
  const allCategories = await db.query.categories.findMany({
    columns: { name: true, id: true, keywords: true },
    where: eq(categories.userId, user.id),
  });

  const transactions = await db.query.bankTransactions.findMany({
    where: eq(transactionTable.userId, user.id),
    orderBy: desc(transactionTable.valueDate),
    columns: {
      additionalInformation: true,
      amount: true,
      bookingDate: true,
      valueDate: true,
      currency: true,
      transactionId: true,
      spendingType: true,
      wantOrNeed: true,
    },
    with: {
      account: { columns: { bban: true, accountId: true, name: true } },
      bank: { columns: { logo: true, name: true } },
      category: { columns: { id: true, name: true, keywords: true } },
    },
  });

  return json({
    transactions,
    categories: allCategories,
  });
}

type SyncTransactionsArgs = {
  context: AppLoadContext;
  userId: number;
};

async function syncTransactions({ context, userId }: SyncTransactionsArgs) {
  const dbApi = DbApi.create({ context });
  const goCardlessApi = GoCardlessApi.create({ context });

  const lastSavedTransactionDate = (await dbApi.getLatestTransactionDate())
    ?.date;
  const fromDate = lastSavedTransactionDate
    ? toLocaleDateString(lastSavedTransactionDate)
    : undefined;

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
  const user = requireUser(context);

  const formData = await request.formData();

  const intent = getZodEnumFromObjectKeys(INTENTS).parse(
    formData.get("intent"),
  );

  if (intent === "sync") {
    return syncTransactions({ context, userId: user.id });
  }

  const transactionId = z.string().parse(formData.get("transactionId"));

  switch (intent) {
    case "updateCategory": {
      const categoryId = z
        .string()
        .nullable()
        .transform((arg) => (arg ? parseInt(arg) : null))
        .parse(formData.get("value"));

      const dbApi = DbApi.create({ context });
      const updatedTransactions = await dbApi.updateTransactionCategories([
        { transactionId, categoryId },
      ]);

      return json({ success: true, transaction: updatedTransactions[0] });
    }
    case "updateSpendingType": {
      const user = requireUser(context);

      const spendingType =
        formData.get("value") !== "null"
          ? getZodEnumFromObjectKeys(SPENDING_TYPES).parse(
              formData.get("value"),
            )
          : null;

      const db = getDbFromContext(context);
      const updatedTransaction = await db
        .update(bankTransactions)
        .set({ spendingType })
        .where(
          and(
            eq(bankTransactions.transactionId, transactionId),
            eq(bankTransactions.userId, user.id),
          ),
        )
        .returning()
        .get();

      return json({ success: true, transaction: updatedTransaction });
    }
    case "updateWantOrNeed": {
      const user = requireUser(context);

      const wantOrNeed =
        formData.get("value") !== "null"
          ? getZodEnumFromObjectKeys(WANT_OR_NEED).parse(formData.get("value"))
          : null;

      const db = getDbFromContext(context);
      const updatedTransaction = await db
        .update(bankTransactions)
        .set({ wantOrNeed })
        .where(
          and(
            eq(bankTransactions.transactionId, transactionId),
            eq(bankTransactions.userId, user.id),
          ),
        )
        .returning()
        .get();

      return json({ success: true, transaction: updatedTransaction });
    }
  }
}

export default function Transactions() {
  const { transactions, categories } = useLoaderData<typeof loader>();
  const actionData = useActionData() as { success: boolean } | undefined;

  const navigate = useNavigate();
  const navigation = useNavigation();

  const isNavigating = navigation.state !== "idle";

  const [globalFilter, setGlobalFilter] = useState("");
  const uniqueBanks = new Set(transactions.map((t) => t.bank.name));
  const uniqueAccountNames = new Set(
    transactions.map((t) => prettifyAccountName(t.account.name)),
  );

  const columns: ColumnDef<ClientTransaction>[] = [
    {
      id: "bank",
      accessorKey: "bank.name",
      filterFn: "arrIncludesSome",
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
    },
    {
      id: "account",
      accessorFn: (row) => prettifyAccountName(row.account?.name ?? ""),
      header: (c) => <SortableHeaderCell context={c} name="Account" />,
      filterFn: "arrIncludesSome",
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
        <CustomSelect
          values={categories.map(({ id, name }) => ({
            key: id.toString(),
            value: name,
          }))}
          intent="updateCategory"
          transactionId={row.original.transactionId}
          placeholder={row.original.category?.name}
        />
      ),
    },
    {
      id: "spendingType",
      accessorFn: (row) =>
        row.spendingType ? SPENDING_TYPES[row.spendingType] : undefined,
      filterFn: "arrIncludesSome",
      header: "Spending Type",
      cell: ({ row }) => (
        <CustomSelect
          values={Object.entries(SPENDING_TYPES).map(([key, value]) => ({
            key,
            value,
          }))}
          intent="updateSpendingType"
          transactionId={row.original.transactionId}
          placeholder={
            row.original.spendingType
              ? SPENDING_TYPES[row.original.spendingType]
              : undefined
          }
        />
      ),
    },
    {
      id: "wantOrNeed",
      accessorFn: (row) =>
        row.wantOrNeed ? WANT_OR_NEED[row.wantOrNeed] : undefined,
      filterFn: "arrIncludesSome",
      header: "Want/Need",
      cell: ({ row }) => (
        <CustomSelect
          values={Object.entries(WANT_OR_NEED).map(([key, value]) => ({
            key,
            value,
          }))}
          intent="updateWantOrNeed"
          transactionId={row.original.transactionId}
          placeholder={
            row.original.wantOrNeed
              ? WANT_OR_NEED[row.original.wantOrNeed]
              : undefined
          }
        />
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
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: "includesString",
    state: {
      globalFilter,
    },
  });

  return (
    <>
      <ActionHeader title="Transactions">
        <Button
          variant="outline"
          onClick={() => navigate(route("/transactions/suggest-categories"))}
        >
          Suggest categories
        </Button>
        <Form method="POST">
          <input readOnly hidden name="intent" value="sync" />
          <Button
            variant="outline"
            disabled={isNavigating}
            className="flex gap-2"
          >
            <RefreshCw
              className={`h-4 w-4 ${isNavigating && "animate-spin"}`}
            />
            Sync transactions
          </Button>
        </Form>
      </ActionHeader>
      <div className="relative top-16 px-6 py-8">
        <Outlet />
        {!!actionData && !actionData.success && (
          <div className="absolute left-1/2 w-96 -translate-x-1/2 transform rounded-md border border-red-300 bg-red-200 px-8 py-4 text-center">
            Something went wrong 😬
          </div>
        )}

        <DataTable table={table}>
          <Input
            placeholder="Filter transactions..."
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
            className="float-start max-w-sm"
          />
          <DataTablePagination table={table} />
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
              <CheckBoxFilterGroup
                header="Spending Type"
                column={table.getColumn("spendingType")}
                values={Object.values(SPENDING_TYPES)}
              />
              <CheckBoxFilterGroup
                header="Want/Need"
                column={table.getColumn("wantOrNeed")}
                values={Object.values(WANT_OR_NEED)}
              />
            </div>
          </DataTableFilter>
        </DataTable>
      </div>
    </>
  );
}

export type Loader = typeof loader;
type ClientTransaction = SerializeFrom<Loader>["transactions"][0];

type CustomSelectProps<T> = {
  values: T[];
  intent: Intent;
  placeholder?: string;
  transactionId: string;
};

function CustomSelect<T extends { key: string; value: string }>({
  values,
  intent,
  placeholder,
  transactionId,
}: CustomSelectProps<T>) {
  const submit = useSubmit();

  return (
    <Select
      onValueChange={(value) => {
        const formData = new FormData();
        formData.append("intent", intent);
        formData.append("transactionId", transactionId);
        formData.append("value", value);

        return submit(formData, { method: "POST" });
      }}
    >
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="null">-</SelectItem>
        {values.map(({ key, value }) => (
          <SelectItem key={key} value={key}>
            {value}
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
