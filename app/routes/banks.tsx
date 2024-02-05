import { ActionArgs, LoaderArgs, json } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import { z } from "zod";
import { requireLogin } from "~/lib/auth.server";
import { getGoCardlessSessionManager } from "~/lib/gocardless.server";

const bankSchema = z.object({
  id: z.string(),
  name: z.string(),
  bic: z.string(),
  transaction_total_days: z.coerce.number(),
  countries: z.array(z.unknown()),
  logo: z.string(),
});

export async function loader(args: LoaderArgs) {
  await requireLogin(args);

  const { request, context } = args;
  const sessionManager = await getGoCardlessSessionManager({
    request,
    context,
  });

  const banksResponse = await fetch(
    "https://bankaccountdata.gocardless.com/api/v2/institutions/?country=no",
    {
      headers: {
        Authorization: `Bearer ${sessionManager.getSessionValue()?.access}`,
        "content-type": "application/json",
      },
    }
  );

  const banks = await banksResponse.json();
  const parsedBanks = bankSchema.array().safeParse(banks);

  return json(
    { banks: parsedBanks.success ? parsedBanks.data : [] },
    { headers: { "Set-Cookie": await sessionManager.commit() } }
  );
}

export async function action(args: ActionArgs) {
  await requireLogin(args);

  const formData = await args.request.formData();

  return json({ message: "This is a POST request" });
}

function Banks() {
  const { banks } = useLoaderData<typeof loader>();

  return (
    <form method="post">
      <select name="bank">
        {banks.map((bank) => (
          <option key={bank.id} value={bank.id}>
            {bank.name}
          </option>
        ))}
      </select>
      <button type="submit">Submit</button>
    </form>
  );
}

export default Banks;
