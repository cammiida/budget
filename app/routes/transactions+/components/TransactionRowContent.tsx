import type { SerializeFrom } from "@remix-run/cloudflare";
import { Form, useSubmit } from "@remix-run/react";
import { formatDate, useRouteLoaderDataTyped } from "~/lib/utils";
import { type Loader } from "../_transactions";
import { DataCell } from "./DataCell";

type TransactionRowContentProps = {
  transaction: ClientTransaction;
  disableChangeCategory?: boolean;
};

export function TransactionRowContent({
  transaction: aggregatedTrans,
  disableChangeCategory = false,
}: TransactionRowContentProps) {
  const { bank, account, category, ...transaction } = aggregatedTrans;

  const { categories } = useRouteLoaderDataTyped<Loader>(
    "routes/transactions+/_transactions",
  );

  const date = transaction.valueDate ?? transaction.bookingDate;

  const submit = useSubmit();

  return (
    <>
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
        {disableChangeCategory ? (
          category?.name
        ) : (
          <Form method="POST">
            <select
              defaultValue={category?.id}
              onChange={(event) => {
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
        )}
      </DataCell>
    </>
  );
}
type ClientTransaction = SerializeFrom<Loader>["transactions"]["entries"][0];
