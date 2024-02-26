import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  json,
} from "@remix-run/cloudflare";
import { Form, useFetcher, useLoaderData } from "@remix-run/react";
import { requireLogin } from "~/lib/auth.server";
import { DbApi } from "~/lib/dbApi";
import { GoCardlessApi } from "~/lib/gocardless-api.server";
import { Bank } from "~/lib/schema";

export async function loader(args: LoaderFunctionArgs) {
  const session = await requireLogin(args);

  const api = DbApi.create(args);
  const user = await api.getUserByEmail(session.email);

  const goCardlessApi = GoCardlessApi.create(args);
  const allBanks = await goCardlessApi.getAllBanks();
  const chosenBanks = await api.getBanks();

  return json({ user, allBanks, chosenBanks });
}

export async function action(args: ActionFunctionArgs) {
  const goCardlessApi = GoCardlessApi.create(args);

  const formData = await args.request.formData();
  const bankId = formData.get("bankId") as string;

  const bank = await goCardlessApi.getBank(bankId);
  if (bank.requisitionId) {
    try {
      await goCardlessApi.getRequisition(bank.requisitionId);
      return json({ bank });
    } catch (error) {
      console.error(
        "Failed to get requisition. Requisition might be expired.",
        error
      );
    }
  }

  try {
    const requisition = await goCardlessApi.createRequisition(bankId);
    // TODO: needed? Can some integrations not need authorization through a link?
    if (!requisition.link) {
      throw new Response("Failed to create requisition with link", {
        status: 500,
      });
    }

    const createdBank = await DbApi.create(args).addBank({
      ...bank,
      requisitionId: requisition.id,
    });

    return json({ bank: createdBank });
  } catch (error) {
    console.error("Failed to create requisition", error);
    throw new Response("Failed to create requisition", { status: 500 });
  }
}

function Banks() {
  const { allBanks: banks, chosenBanks } = useLoaderData<typeof loader>();

  return (
    <div>
      <div className="flex flex-col gap-4">
        <h1 className="text-lg">Your banks</h1>
        {chosenBanks.map((it) => (
          <BankComponent bank={it} key={it.bankId} />
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

function BankComponent({ bank }: { bank: Bank }) {
  const fetcher = useFetcher();
  const isDeleting = fetcher.state !== "idle";

  return (
    <div key={bank.bankId} className="flex gap-2">
      <img
        className="w-8 h-8 rounded-full"
        src={bank.logo ?? undefined}
        alt={bank.name}
      />
      <span>{bank.name}</span>
      <fetcher.Form method="delete" action="/api/remove-bank">
        <input type="hidden" name="bankId" value={bank.bankId} />
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
