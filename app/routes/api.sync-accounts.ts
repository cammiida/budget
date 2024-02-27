import { ActionFunctionArgs, json, redirect } from "@remix-run/cloudflare";
import { DbApi } from "~/lib/dbApi";
import { NewAccount } from "~/lib/schema";
import { getAccountsForBank } from "~/lib/services/accounts.server";
import { getOrCreateRequisition } from "~/lib/services/requisition.server";

export async function action({ context, request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const bankId = formData.get("bankId") as string;

  const user = context.user;
  if (!user) {
    throw redirect("/login");
  }

  try {
    const requisition = await getOrCreateRequisition({ bankId, context });
    const isRequisitionActivated = requisition.agreement;
    if (!isRequisitionActivated) {
      if (!requisition.link) {
        throw Error("No requisition link");
      } else {
        return redirect(requisition.link);
      }
    }

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
