import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { json, redirect } from "@remix-run/cloudflare";
import {
  useLoaderData,
  useNavigate,
  useSearchParams,
  useSubmit,
} from "@remix-run/react";
import { desc, eq } from "drizzle-orm";
import { useState } from "react";
import { route } from "routes-gen";
import { Button } from "~/components/ui/button";
import Modal from "~/components/ui/modal";
import { getDbFromContext } from "~/lib/db.service.server";
import { category, transaction as transactionTable } from "~/lib/schema";
import { DataCell, TransactionRowContent } from "./transactions";

export async function loader({ context }: LoaderFunctionArgs) {
  const user = context.user;
  if (!user) {
    return redirect(route("/auth/login"));
  }

  const db = getDbFromContext(context);

  const [transactions, categories] = await db.batch([
    db.query.transaction.findMany({
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
    db.select().from(category).where(eq(category.userId, user.id)),
  ]);

  const transactionsWithSuggestedCategory = transactions
    .map((transaction) => {
      const suggestedCategory = categories.find((category) =>
        category.keywords?.some((keyword) =>
          transaction.additionalInformation
            ?.toLocaleLowerCase()
            .includes(keyword.toLocaleLowerCase()),
        ),
      );

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

export default function SuggestCategories() {
  const { transactionsWithSuggestedCategory: transactions } =
    useLoaderData<typeof loader>();

  const submit = useSubmit();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [transactionsToSave, setTransactionsToSave] = useState<string[]>([]);

  function handleClose() {
    navigate(route("/transactions") + `?${searchParams.toString()}`);
  }

  function handleCheckboxChange(checked: boolean, transactionId: string) {
    if (checked) {
      setTransactionsToSave((prev) => [...new Set([...prev, transactionId])]);
    } else {
      setTransactionsToSave((prev) =>
        prev.filter((id) => id !== transactionId),
      );
    }
  }

  function handleSave() {
    const formData = new FormData();
    formData.append("intent", "saveCategories");
    formData.append(
      "transactions",
      JSON.stringify(
        transactionsToSave.map((transactionId) => ({
          transactionId,
          categoryId: transactions.find(
            (transaction) => transaction.transactionId === transactionId,
          )?.suggestedCategory.id,
        })),
      ),
    );

    submit(formData, { method: "POST", action: route("/transactions") });
  }

  const saveButton = <Button onClick={handleSave}>Save</Button>;

  return (
    <Modal
      title="Suggest Categories"
      isOpen={true}
      onClose={handleClose}
      actionButton={saveButton}
    >
      <div className="flex h-96 flex-col gap-4">
        <div className="flex justify-end gap-4">
          <Button
            variant="link"
            className="self-end"
            onClick={() =>
              setTransactionsToSave(transactions.map((it) => it.transactionId))
            }
          >
            Select all
          </Button>
          <Button
            variant="link"
            className="self-end"
            onClick={() => setTransactionsToSave([])}
          >
            Deselect all
          </Button>
        </div>
        <table className="overflow-auto">
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
          <tbody className="overflow-scroll">
            {transactions.map((transaction) => (
              <tr key={transaction.transactionId}>
                <DataCell>
                  {transaction.suggestedCategory && (
                    <input
                      type="checkbox"
                      disabled={!transaction.suggestedCategory}
                      checked={
                        !!transactionsToSave.includes(transaction.transactionId)
                      }
                      onChange={(e) =>
                        handleCheckboxChange(
                          e.currentTarget.checked,
                          transaction.transactionId,
                        )
                      }
                    />
                  )}
                </DataCell>
                <TransactionRowContent
                  transaction={transaction}
                  disableChangeCategory
                />
                <DataCell>{transaction.suggestedCategory?.name}</DataCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
