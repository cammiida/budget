import { json, redirect, type LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import { and, eq } from "drizzle-orm";
import { route } from "routes-gen";
import { getDbFromContext } from "~/lib/db.service.server";
import { budgets } from "~/lib/schema";

export async function loader({ context, params }: LoaderFunctionArgs) {
  const user = context.user;
  if (!user) {
    return redirect(route("/auth/login"));
  }
  const budgetName = params.budgetName;
  if (!budgetName) {
    return redirect(route("/budgets"));
  }

  const db = getDbFromContext(context);
  const budget = await db
    .select()
    .from(budgets)
    .where(and(eq(budgets.userId, user.id), eq(budgets.name, budgetName)))
    .get();

  return json({ budget });
}

export default function Budget() {
  const { budget } = useLoaderData<typeof loader>();

  return <div>{budget?.name}</div>;
}
