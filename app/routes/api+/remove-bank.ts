import type { ActionFunctionArgs } from "@remix-run/cloudflare";
import { json } from "@remix-run/cloudflare";
import { requireUser } from "~/lib/auth.server";
import { DbApi } from "~/lib/dbApi";

export async function action({ context, request }: ActionFunctionArgs) {
  requireUser(context);
  const bankId = (await request.formData()).get("bankId") as string;

  if (!bankId) {
    throw new Response("Bank id is required", {
      status: 400,
    });
  }

  const result = await DbApi.create({ context }).removeBank(bankId);

  return json({ result });
}
