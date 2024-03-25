import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
} from "@remix-run/cloudflare";
import { json, redirect } from "@remix-run/cloudflare";
import { Form, NavLink, Outlet, useLoaderData } from "@remix-run/react";
import { eq } from "drizzle-orm";
import { PlusCircle } from "lucide-react";
import { useState } from "react";
import { route } from "routes-gen";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { requireUser } from "~/lib/auth.server";
import { getDbFromContext } from "~/lib/db.service.server";
import { budgets as budgetTable, budgets } from "~/lib/schema";

export async function action({ request, context }: ActionFunctionArgs) {
  const user = context.user;
  if (!user) {
    return redirect(route("/login"));
  }

  const schema = z.object({
    name: z.string().min(2),
  });

  const formData = await request.formData();
  const { name } = schema.parse(Object.fromEntries(formData));

  const db = getDbFromContext(context);
  await db.insert(budgets).values({ userId: user.id, name }).returning().get();

  return redirect(route("/budgets"));
}

export async function loader({ context }: LoaderFunctionArgs) {
  const user = requireUser(context);
  const db = getDbFromContext(context);

  const budgets = await db
    .select()
    .from(budgetTable)
    .where(eq(budgetTable.userId, user.id))
    .all();

  return json({ budgets });
}

export default function Budgets() {
  const { budgets } = useLoaderData<typeof loader>();
  const [isFormHidden, setIsFormHidden] = useState(true);

  return (
    <div className="relative flex">
      <div className="min-w-56 p-4">
        <h1 className="mb-4 text-xl">Budgets</h1>
        <ul className="flex flex-col gap-4">
          {budgets.map((budget) => (
            <NavLink
              key={budget.id}
              className={({ isActive }) =>
                `${isActive && "underline"} flex grow items-center gap-2`
              }
              to={route("/budgets/:budgetName", { budgetName: budget.name })}
            >
              {budget.name}
            </NavLink>
          ))}
        </ul>

        <div className="my-4">
          {isFormHidden ? (
            <Button
              variant="secondary"
              className="flex gap-2"
              onClick={() => setIsFormHidden(false)}
            >
              <PlusCircle />
              New budget
            </Button>
          ) : (
            <Form
              method="POST"
              hidden={isFormHidden}
              className="flex flex-col gap-4"
            >
              <Input name="name" placeholder="Budget name" />
              <div className="flex gap-1">
                <Button type="submit" className="self-start">
                  Create budget
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setIsFormHidden(true)}
                >
                  Cancel
                </Button>
              </div>
            </Form>
          )}
        </div>
      </div>
      <div className="grow">
        <Outlet />
      </div>
    </div>
  );
}
