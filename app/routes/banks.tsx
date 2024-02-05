import { ActionArgs, LoaderArgs, json } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import { z } from "zod";
import { Api } from "~/lib/api.server";
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
  const session = await requireLogin(args);

  const api = Api.create(args.context);
  const user = await api.getUserByEmail(session.email);

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

  const parsedBanks = bankSchema.array().safeParse(await banksResponse.json());
  const banks = parsedBanks.success ? parsedBanks.data : [];
  const chosenBankIds = await api.getAllBanksForUser(user.id);
  const chosenBanks = banks.filter((bank) => chosenBankIds.includes(bank.id));

  return json(
    { user, banks: parsedBanks.success ? parsedBanks.data : [], chosenBanks },
    { headers: { "Set-Cookie": await sessionManager.commit() } }
  );
}

export async function action(args: ActionArgs) {
  console.log("action");

  const userEmail = (await requireLogin(args)).email;

  const api = Api.create(args.context);

  const formData = await args.request.formData();
  const chosenBank = formData.get("bank");
  const userId = (await api.getUserByEmail(userEmail)).id;
  console.log({ chosenBank, userId });

  const result = await api.addUserBankRelation({
    userId,
    bankId: chosenBank as string,
  });
  console.log({ result: result });

  return json({ message: "This is a POST request" });
}

function Banks() {
  const { banks, chosenBanks } = useLoaderData<typeof loader>();

  return (
    <div>
      <div className="flex flex-col gap-4">
        <h1 className="text-lg">Your banks</h1>
        {chosenBanks.map((it) => (
          <div key={it.id} className="flex gap-2">
            <img className="w-8 h-8 rounded-full" src={it.logo} alt={it.name} />
            <span>{it.name}</span>
          </div>
        ))}
      </div>
      <div>
        <h2 className="text-lg">Add a new bank</h2>
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
      </div>
    </div>
  );
}

export default Banks;
