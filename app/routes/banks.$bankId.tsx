import { LoaderArgs, json } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import { GoCardlessApi } from "~/lib/gocardless-api.server";

export async function loader(args: LoaderArgs) {
  const bankId = args.params.bankId!!;

  const goCardlessApi = await GoCardlessApi.create(args);
  const chosenBanks = await goCardlessApi.getChosenBanks();

  // TODO: api call to get bank by id
  const bank = chosenBanks.find((it) => it.id === bankId);

  const accounts = await goCardlessApi.listAccounts(bankId);

  return json({ bank, accounts });
}

export default function Bank() {
  const { bank, accounts } = useLoaderData<typeof loader>();

  return (
    <div>
      <h1>{bank?.name}</h1>
      <ul>
        {/* {accounts?.map((account) => (
          <li key={account.id}>{account.account_number}</li>
        ))} */}
      </ul>
    </div>
  );
}
