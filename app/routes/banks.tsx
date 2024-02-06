import { ActionArgs, LoaderArgs, json, redirect } from "@remix-run/cloudflare";
import { Form, useFetcher, useLoaderData } from "@remix-run/react";
import { z } from "zod";
import { requireLogin } from "~/lib/auth.server";
import { DbApi } from "~/lib/dbApi";
import { GoCardlessApi } from "~/lib/gocardless-api.server";

export const bankSchema = z.object({
  id: z.string(),
  name: z.string(),
  bic: z.string(),
  transaction_total_days: z.coerce.number(),
  countries: z.array(z.unknown()),
  logo: z.string(),
});
export type Bank = z.infer<typeof bankSchema>;

export async function loader(args: LoaderArgs) {
  const session = await requireLogin(args);

  const api = DbApi.create(args);
  const user = await api.getUserByEmail(session.email);

  const goCardlessApi = await GoCardlessApi.create(args);
  const allBanks = await goCardlessApi.getAllBanks();
  const chosenBanks = await goCardlessApi.getChosenBanks();

  return json(
    { user, allBanks, chosenBanks },
    { headers: { "Set-Cookie": await goCardlessApi.commitSession() } }
  );
}

export async function action(args: ActionArgs) {
  const userEmail = (await requireLogin(args)).email;

  const api = DbApi.create(args);

  const formData = await args.request.formData();
  const chosenBank = formData.get("bank") as string;
  const userId = (await api.getUserByEmail(userEmail)).id;
  const requisition = await api.getRequisition(chosenBank);

  await api.addUserBankRelation({
    userId,
    bankId: chosenBank as string,
    requisitionId: requisition.id,
  });

  return redirect(requisition.link);
}

function Banks() {
  const { allBanks: banks, chosenBanks } = useLoaderData<typeof loader>();

  return (
    <div>
      <div className="flex flex-col gap-4">
        <h1 className="text-lg">Your banks</h1>
        {chosenBanks.map((it) => (
          <Bank bank={it} key={it.id} />
        ))}
      </div>
      <div>
        <h2 className="text-lg">Add a new bank</h2>
        <Form method="post">
          <select name="bank">
            {banks.map((bank) => (
              <option key={bank.id} value={bank.id}>
                {bank.name}
              </option>
            ))}
          </select>
          <button type="submit">Submit</button>
        </Form>
      </div>
    </div>
  );
}

export default Banks;

function Bank({ bank }: { bank: Bank }) {
  const fetcher = useFetcher();
  const isDeleting = fetcher.state !== "idle";

  return (
    <div key={bank.id} className="flex gap-2">
      <img className="w-8 h-8 rounded-full" src={bank.logo} alt={bank.name} />
      <span>{bank.name}</span>
      <fetcher.Form method="delete" action="/api/remove-bank">
        <input type="hidden" name="bank" value={bank.id} />
        <button
          className="disabled:opacity-50 bg-red-500 text-white px-2 py-1 rounded-md"
          type="submit"
          disabled={isDeleting}
        >
          {isDeleting ? "Deleting..." : "Delete"}
        </button>
      </fetcher.Form>
    </div>
  );
}
