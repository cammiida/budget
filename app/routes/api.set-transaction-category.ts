import { ActionFunctionArgs, redirect } from "@remix-run/cloudflare";
import { eq } from "drizzle-orm";
import { route } from "routes-gen";
import { z } from "zod";
import { getDbFromContext } from "~/lib/db.service.server";
import { transaction as transactionTable } from "~/lib/schema";

export async function action({ request, context }: ActionFunctionArgs) {
  const formData = await request.formData();
  const categoryId = z
    .string()
    .transform((arg) => (arg === "" ? null : Number(arg)))
    .parse(formData.get("categoryId"));
  const trasactionId = z.string().parse(formData.get("transactionId"));

  const userId = context.user?.id;
  if (!userId) {
    throw redirect(route("/auth/login"));
  }

  const db = getDbFromContext(context);
  const transaction = await db
    .update(transactionTable)
    .set({ categoryId })
    .where(eq(transactionTable.transactionId, trasactionId))
    .returning()
    .get();

  return { transaction };
}
