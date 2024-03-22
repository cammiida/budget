import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  SerializeFrom,
} from "@remix-run/cloudflare";
import { json, redirect } from "@remix-run/cloudflare";
import {
  Form,
  useLoaderData,
  useNavigate,
  useSearchParams,
} from "@remix-run/react";
import type { ColumnDef } from "@tanstack/react-table";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { desc, eq } from "drizzle-orm";
import { Link } from "react-router-dom";
import { route } from "routes-gen";
import ClientOnly from "~/components/client-only";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { DataTable } from "~/components/ui/data-table";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { getDbFromContext } from "~/lib/db.service.server";
import { DbApi } from "~/lib/dbApi";
import {
  categories as categoriesTable,
  bankTransactions as transactionTable,
} from "~/lib/schema";
import { formatDate } from "~/lib/utils";
import { transactionStringSchema } from "./_transactions";

export async function loader({ context }: LoaderFunctionArgs) {
  const user = context.user;
  if (!user) {
    return redirect(route("/auth/login"));
  }

  const db = getDbFromContext(context);

  const [transactions, categories] = await db.batch([
    db.query.bankTransactions.findMany({
      where: eq(transactionTable.userId, user.id),
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
    }),
    db
      .select()
      .from(categoriesTable)
      .where(eq(categoriesTable.userId, user.id)),
  ]);

  const transactionsWithSuggestedCategory = transactions
    .map((transaction) => {
      const suggestedCategory = categories.find((category) => {
        if (!category.keywords?.filter(Boolean).length) {
          return false;
        }

        return category.keywords.some((keyword) =>
          transaction.additionalInformation
            ?.toLocaleLowerCase()
            .includes(keyword.toLocaleLowerCase()),
        );
      });

      return { ...transaction, suggestedCategory };
    })
    .filter(
      (transaction) =>
        !!transaction.suggestedCategory &&
        transaction.category?.id !== transaction.suggestedCategory.id,
    ) as ((typeof transactions)[number] & {
    suggestedCategory: (typeof categories)[number];
  })[];

  return json({ transactionsWithSuggestedCategory });
}

type ClientTransaction = SerializeFrom<
  typeof loader
>["transactionsWithSuggestedCategory"][number];

export async function action({ request, context }: ActionFunctionArgs) {
  const formData = await request.formData();
  const transactions = transactionStringSchema.parse(
    formData.get("transactions"),
  );

  const dbApi = DbApi.create({ context });
  await dbApi.updateTransactionCategories(transactions);

  const searchParams = new URL(request.url).searchParams;

  return redirect(route("/transactions") + `?${searchParams.toString()}`);
}

export default function SuggestCategories() {
  const { transactionsWithSuggestedCategory: transactions } =
    useLoaderData<typeof loader>();

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  function handleClose() {
    navigate(route("/transactions") + `?${searchParams.toString()}`);
  }

  const columns: ColumnDef<ClientTransaction>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
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
      accessorKey: "suggestedCategory.name",
      header: "Category",
    },
  ];

  const table = useReactTable({
    data: transactions,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <ClientOnly>
      {() => (
        <Dialog open onOpenChange={handleClose}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-lg">
                Suggested categories
              </DialogTitle>
            </DialogHeader>
            <div className="flex h-96 flex-col gap-4">
              <DataTable table={table} />
            </div>
            <DialogFooter className="sm:justify-start">
              <DialogClose asChild>
                <Link
                  to={route("/transactions") + `?${searchParams.toString()}`}
                >
                  <Button type="button" variant="secondary">
                    Cancel
                  </Button>
                </Link>
              </DialogClose>
              <Form method="POST">
                <input
                  readOnly
                  hidden
                  name="transactions"
                  value={JSON.stringify(
                    table
                      .getSelectedRowModel()
                      .rows.map(
                        ({
                          original: { transactionId, suggestedCategory },
                        }) => ({
                          transactionId,
                          categoryId: suggestedCategory.id,
                        }),
                      ),
                  )}
                />
                <Button type="submit">Save</Button>
              </Form>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </ClientOnly>
  );
}
