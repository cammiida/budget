import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { json } from "@remix-run/cloudflare";
import { Form, Link, useFetcher, useLoaderData } from "@remix-run/react";
import { route } from "routes-gen";
import { Button } from "~/components/ui/button";
import { requireLogin } from "~/lib/auth.server";
import { DbApi } from "~/lib/dbApi";
import { GoCardlessApi } from "~/lib/gocardless-api.server";
import type { Bank } from "~/lib/schema";

export async function loader({ context, request }: LoaderFunctionArgs) {
  const session = await requireLogin({ context, request });

  const api = DbApi.create({ context });
  const user = await api.getUserByEmail(session.email);

  const goCardlessApi = GoCardlessApi.create({ context });
  const allBanks = await goCardlessApi.getAllBanks();
  const chosenBanks = await api.getBanks();

  return json({ user, allBanks, chosenBanks });
}

function Banks() {
  const { allBanks: banks, chosenBanks } = useLoaderData<typeof loader>();

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-10">
      <div className="w-full">
        <h2 className="text-lg">Add a new bank</h2>
        <Form method="post" action={route("/banks/new")}>
          <select name="bankId">
            {banks.map((bank) => (
              <option key={bank.id} value={bank.id}>
                {bank.name}
              </option>
            ))}
          </select>
          <button type="submit">Submit</button>
        </Form>
      </div>
      <div className="flex w-full flex-col gap-4">
        <h1 className="text-lg">Your banks</h1>
        {chosenBanks.map((it) => (
          <BankComponent bank={it} key={it.bankId} />
        ))}
      </div>
    </div>
  );
}

export default Banks;

function BankComponent({ bank }: { bank: Bank }) {
  const fetcher = useFetcher();
  const isDeleting = fetcher.state !== "idle";

  return (
    <div
      key={bank.bankId}
      className="flex gap-2 rounded-md bg-slate-50 p-5 shadow-sm"
    >
      <Link
        className="flex grow items-center gap-2"
        to={route("/banks/:bankId", { bankId: bank.bankId })}
      >
        <img
          className="h-8 w-8 rounded-full"
          src={bank.logo ?? undefined}
          alt={bank.name}
        />
        <span>{bank.name}</span>
      </Link>
      <fetcher.Form method="delete" action={route("/api/remove-bank")}>
        <input type="hidden" name="bankId" value={bank.bankId} />
        <Button
          className="rounded-md bg-red-500 px-2 py-1 text-white disabled:opacity-50"
          type="submit"
          disabled={isDeleting}
        >
          {isDeleting ? "Deleting..." : "Delete"}
        </Button>
      </fetcher.Form>
    </div>
  );
}
