import { ActionFunctionArgs, json, redirect } from "@remix-run/cloudflare";
import { DbApi } from "~/lib/dbApi";
import { NewAccount } from "~/lib/schema";
import { getAccountsForBank } from "~/lib/services/accounts.server";

export async function action({ context, request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const bankId = formData.get("bankId")?.toString();

  if (!bankId) {
    throw new Response("Bank ID is required", { status: 400 });
  }

  const user = context.user;
  if (!user) {
    throw redirect("/login");
  }

  try {
    const accounts: NewAccount[] = await getAccountsForBank({
      bankId,
      context,
    });

    const savedAccounts = await DbApi.create({ context }).saveAccounts(
      accounts
    );

    return json({
      savedAccounts,
    });
  } catch (error) {
    console.error("Failed to sync accounts", error);
    throw new Response("An error happened", { status: 500 });
  }
}
