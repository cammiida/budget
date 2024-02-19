import { ActionFunctionArgs, json } from "@remix-run/cloudflare";
import { z } from "zod";
import { requireLogin } from "~/lib/auth.server";
import { DbApi } from "~/lib/dbApi";
import { GoCardlessApi } from "~/lib/gocardless-api.server";

export async function loader(request: Request) {
  return json({ message: "Hello, world!" });
}

export async function action(args: ActionFunctionArgs) {
  const session = await requireLogin(args);
  const goCardlessApi = await GoCardlessApi.create(args);
  const goCardlessSession = await goCardlessApi.getSession();

  const api = DbApi.create(args);
  const user = await api.getUserByEmail(session.email);
  const institutionId = (await args.request.formData()).get("bank") as string;

  if (!institutionId) {
    return new Response("Bank id is required", {
      status: 400,
    });
  }

  const response = await fetch(
    "https://bankaccountdata.gocardless.com/api/v2/requisitions/",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${goCardlessSession.data.goCardless?.access}`,
      },
      body: JSON.stringify({
        redirect: "http://localhost:8788/api/authenticate-bank",
        institution_id: institutionId,
      }),
    }
  )
    .then((res) => res.json())
    .then((res) => z.object({ id: z.string(), link: z.string() }).parse(res));

  // save the response.id to the user session

  return fetch(response.link);
}
