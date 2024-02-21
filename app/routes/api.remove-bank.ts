import { ActionFunctionArgs, json } from "@remix-run/cloudflare";
import { DbApi } from "~/lib/dbApi";

export async function action(args: ActionFunctionArgs) {
  const bankId = (await args.request.formData()).get("bank") as string;

  if (!bankId) {
    throw new Response("Bank id is required", {
      status: 400,
    });
  }

  const result = await DbApi.create(args).removeBank(bankId);

  return json({ result });
}
