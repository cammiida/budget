import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  json,
  redirect,
} from "@remix-run/cloudflare";
import { Form, Link, useFetcher, useLoaderData } from "@remix-run/react";
import { requireLogin } from "~/lib/auth.server";
import { DbApi } from "~/lib/dbApi";
import { GoCardlessApi } from "~/lib/gocardless-api.server";
import { Bank } from "~/lib/schema";

export async function loader({ context, request }: LoaderFunctionArgs) {
  const session = await requireLogin({ context, request });

  const api = DbApi.create({ context });
  const user = await api.getUserByEmail(session.email);

  const goCardlessApi = GoCardlessApi.create({ context });
  const allBanks = await goCardlessApi.getAllBanks();
  const chosenBanks = await api.getBanks();

  return json({ user, allBanks, chosenBanks });
}

export async function action({ context, request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const bankId = formData.get("bankId")?.toString();

  if (!bankId) {
    throw new Response("Bank ID is required", { status: 400 });
  }

  const dbApi = DbApi.create({ context });
  try {
    // get or add bank
    const bank = await dbApi.getBank(bankId);
    console.log("bank", bank);

    // get existing requisition
    const goCardlessApi = GoCardlessApi.create({ context });
    const existingRequistion = bank?.requisitionId
      ? await goCardlessApi.getRequisition({
          requisitionId: bank.requisitionId,
        })
      : null;

    // if requisition exists and is not expired, return requisition
    if (existingRequistion && existingRequistion.status !== "EX") {
      return json({ bank, requisition: existingRequistion });
    }

    // else create a new requisition and redirect to bank authorization
    const url = new URL(request.url);

    // So that redirects work for all three variants
    if (url.hostname === "0.0.0.0" || url.hostname === "127.0.0.1") {
      url.hostname = "localhost";
    }

    const newRequisition = await goCardlessApi.createRequisition({
      bankId,
      redirect: `${url.protocol}//${url.host}/api/authenticate-bank/${bankId}`,
    });

    if (!newRequisition.link) {
      throw new Response("Failed to create requisition with link", {
        status: 500,
      });
    }

    return redirect(newRequisition.link);
  } catch (error) {
    console.error("Failed to create requisition", error);
    throw new Response("Failed to create requisition", { status: 500 });
  }
}

function Banks() {
  const { allBanks: banks, chosenBanks } = useLoaderData<typeof loader>();

  return (
    <div className="flex flex-col items-center max-w-lg gap-10 mx-auto">
      <div className="w-full">
        <h2 className="text-lg">Add a new bank</h2>
        <Form method="post">
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
      <div className="flex flex-col gap-4 w-full">
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
      className="flex gap-2 bg-slate-50 p-5 rounded-md shadow-sm"
    >
      <Link
        className="flex grow gap-2 items-center"
        to={`/banks/${bank.bankId}`}
      >
        <img
          className="w-8 h-8 rounded-full"
          src={bank.logo ?? undefined}
          alt={bank.name}
        />
        <span>{bank.name}</span>
      </Link>
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
