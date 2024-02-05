import { ActionArgs, json } from "@remix-run/cloudflare";
import { Api } from "~/lib/api.server";
import { requireLogin } from "~/lib/auth.server";

export async function action(args: ActionArgs) {
  const session = await requireLogin(args);
  const api = Api.create(args.context);
  const user = await api.getUserByEmail(session.email);
  const bankId = (await args.request.formData()).get("bank") as string;

  if (!bankId) {
    return new Response("Bank id is required", {
      status: 400,
    });
  }

  const result = await api.removeBankForUser(user.id, bankId);

  return json({ result });
}
