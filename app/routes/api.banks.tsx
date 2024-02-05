import { LoaderArgs, json } from "@remix-run/cloudflare";
import { requireLogin } from "~/lib/auth.server";
import { goCardlessLogin } from "~/lib/gocardless.server";

export async function loader(args: LoaderArgs) {
  await requireLogin(args);

  const { request, context } = args;
  const goCardlessSession = await goCardlessLogin(request, context);

  const banksResponse = await fetch(
    "https://bankaccountdata.gocardless.com/api/v2/institutions/?country=no",
    {
      headers: {
        Authorization: `Bearer ${goCardlessSession.getSessionValue()?.access}`,
        "content-type": "application/json",
      },
    }
  );

  const banks = await banksResponse.json();

  return json(
    { banks },
    { headers: { "Set-Cookie": await goCardlessSession.commit() } }
  );
}
