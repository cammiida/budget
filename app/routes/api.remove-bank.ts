import { ActionFunctionArgs, json } from "@remix-run/cloudflare";
import { DbApi } from "~/lib/dbApi";

export async function action({ context, request }: ActionFunctionArgs) {
  const bankId = (await request.formData()).get("bankId") as string;

  if (!bankId) {
    throw new Response("Bank id is required", {
      status: 400,
    });
  }

  const result = await DbApi.create({ context }).removeBank(bankId);

  return json({ result });
}
