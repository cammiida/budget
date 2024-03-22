import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { json, redirect } from "@remix-run/cloudflare";
import { Outlet, useLoaderData } from "@remix-run/react";
import { format } from "date-fns";
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
    <div className="relative">
      <Outlet />
      <h1>Budget</h1>
      <div>
        {budgets.map((budget) => (
          <div key={budget.id}>
            {format(budget.startDate, "PPP")} - {format(budget.endDate, "PPP")}
          </div>
        ))}
      </div>
    </div>
  );
}
