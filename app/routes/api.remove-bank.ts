import { ActionFunctionArgs, json, redirect } from "@remix-run/cloudflare";
import { requireLogin } from "~/lib/auth.server";
import { DbApi } from "~/lib/dbApi";

export async function action(args: ActionFunctionArgs) {
  const session = await requireLogin(args);
  const api = DbApi.create(args);
  const user = await api.getUserByEmail(session.email);
  // TODO: correct flow?
  if (!user) {
    throw redirect("/auth/login");
  }

  const bankId = (await args.request.formData()).get("bank") as string;

  if (!bankId) {
    throw new Response("Bank id is required", {
      status: 400,
    });
  }

  const result = await api.removeBankForUser(user.id, bankId);

  return json({ result });
}
