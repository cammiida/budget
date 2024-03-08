import { ActionFunctionArgs, redirect } from "@remix-run/cloudflare";
import { eq } from "drizzle-orm";
import { route } from "routes-gen";
import { z } from "zod";
import { getDbFromContext } from "~/lib/db.service.server";
import { transaction as transactionTable } from "~/lib/schema";

export async function action({ request, context }: ActionFunctionArgs) {
  const userId = context.user?.id;
  if (!userId) {
    throw redirect(route("/auth/login"));
  }

  const formData = await request.formData();
  const transactions = z
    .string()
    .transform((arg) =>
      z
        .array(z.object({ transactionId: z.string(), categoryId: z.number() }))
        .parse(JSON.parse(arg)),
    )
    .parse(formData.get("transactions"));

  const db = getDbFromContext(context);

  const updatedTransactions = await Promise.all(
    transactions.map((transaction) =>
      db
        .update(transactionTable)
        .set({ categoryId: transaction.categoryId })
        .where(eq(transactionTable.transactionId, transaction.transactionId))
        .returning()
        .get(),
    ),
  );

  return { updatedTransactions };
}
