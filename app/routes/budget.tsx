import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { json, redirect } from "@remix-run/cloudflare";
import { Outlet, useLoaderData } from "@remix-run/react";
import { eq } from "drizzle-orm";
import { route } from "routes-gen";
import { getDbFromContext } from "~/lib/db.service.server";
import { budgets as budgetTable } from "~/lib/schema";

export async function loader({ context }: LoaderFunctionArgs) {
  const user = context.user;
  if (!user) {
    return redirect(route("/auth/login"));
  }
  const db = getDbFromContext(context);
  const budgets = await db
    .select()
    .from(budgetTable)
    .where(eq(budgetTable.userId, user.id))
    .all();

  return json({ budgets });
}

export default function Budget() {
  const { budgets } = useLoaderData<typeof loader>();

  return (
    <div className="relative flex">
      <div className="min-w-36 px-4 ">
        <h1 className="text-xl">Budgets</h1>
        <ul>
          {budgets.map((budget) => (
            <h2 key={budget.id}>{budget.name}</h2>
          ))}
        </ul>
      </div>
      <div className="grow">
        <Outlet />
      </div>
    </div>
  );
}
