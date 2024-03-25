import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { json } from "@remix-run/cloudflare";
import {
  Link,
  NavLink,
  Outlet,
  useFetcher,
  useLoaderData,
  useParams,
} from "@remix-run/react";
import { route } from "routes-gen";
import { Button } from "~/components/ui/button";
import { requireUser } from "~/lib/auth.server";
import { DbApi } from "~/lib/dbApi";
import type { Bank } from "~/lib/schema";

export async function loader({ context, request }: LoaderFunctionArgs) {
  requireUser(context);
  const chosenBanks = await DbApi.create({ context }).getBanks();

  return json({ chosenBanks });
}

function Banks() {
  const { chosenBanks } = useLoaderData<typeof loader>();

  return (
    <div className="mx-auto flex max-w-3xl items-start">
      <div className="flex w-2/5 flex-col gap-4">
        <Link to={route("/banks/new")} className="self-end">
          <Button variant="secondary">Add bank</Button>
        </Link>
        {chosenBanks.map((it) => (
          <BankComponent bank={it} key={it.bankId} />
        ))}
      </div>
      <div className="w-3/5 px-8">
        <Outlet />
      </div>
    </div>
  );
}

export default Banks;

function BankComponent({ bank }: { bank: Bank }) {
  const fetcher = useFetcher();
  const isDeleting = fetcher.state !== "idle";
  const params = useParams();

  const isActive = params.bankId === bank.bankId;

  return (
    <NavLink
      className={`${isActive && "bg-slate-200"} flex  grow items-center gap-2 rounded-md bg-slate-50 p-5 shadow-sm`}
      to={route("/banks/:bankId", { bankId: bank.bankId })}
    >
      <img
        className="h-8 w-8 rounded-full"
        src={bank.logo ?? undefined}
        alt={bank.name}
      />
      <span>{bank.name}</span>
      <fetcher.Form
        method="delete"
        action={route("/api/remove-bank")}
        className="ml-auto"
      >
        <input type="hidden" name="bankId" value={bank.bankId} />
        <Button
          variant="destructive"
          type="submit"
          disabled={isDeleting}
          onClick={(e) => {
            e.stopPropagation(); // stop click on card
          }}
        >
          {isDeleting ? "Deleting..." : "Delete"}
        </Button>
      </fetcher.Form>
    </NavLink>
  );
}