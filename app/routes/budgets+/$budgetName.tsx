import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
} from "@remix-run/cloudflare";
import { json, redirect } from "@remix-run/cloudflare";
import { Form, useLoaderData, useSearchParams } from "@remix-run/react";
import { addMonths, format, startOfMonth } from "date-fns";
import { and, eq } from "drizzle-orm";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { route } from "routes-gen";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { getDbFromContext } from "~/lib/db.service.server";
import { budgets, categoryGroups } from "~/lib/schema";

const createCategoryGroupSchema = z.object({
  name: z.string().min(2),
});

export async function action({ request, context, params }: ActionFunctionArgs) {
  const user = context.user;
  if (!user) {
    return redirect(route("/auth/login"));
  }

  const formData = await request.formData();

  const { name: categoryName } = createCategoryGroupSchema.parse(
    Object.fromEntries(formData),
  );

  const db = getDbFromContext(context);

  const budget = await db
    .select({ id: budgets.id })
    .from(budgets)
    .where(
      and(eq(budgets.userId, user.id), eq(budgets.name, params.budgetName!)),
    )
    .get();

  if (!budget) {
    return json({ error: "Budget not found" }, { status: 404 });
  }

  const createdCategory = await db
    .insert(categoryGroups)
    .values({ userId: user.id, name: categoryName, budgetId: budget.id })
    .returning()
    .get();

  return json({ success: true, createdCategory });
}

const dateSchema = z
  .object({
    date: z.coerce.date().optional(),
  })
  .transform(({ date }) => ({
    date: startOfMonth(date ?? new Date()),
  }));

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
  const budget = await db.query.budgets.findFirst({
    columns: { name: true },
    where: and(eq(budgets.userId, user.id), eq(budgets.name, budgetName)),
    with: {
      categoryGroups: {
        columns: { name: true },
      },
    },
  });

  return json({ budget });
}

export default function Budget() {
  const { budget } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const { date } = dateSchema.parse(Object.fromEntries(searchParams));

  function prevMonth() {
    searchParams.set("date", format(addMonths(date, -1), "yyyy-MM"));
    setSearchParams(searchParams);
  }

  function nextMonth() {
    searchParams.set("date", format(addMonths(date, 1), "yyyy-MM"));
    setSearchParams(searchParams);
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={prevMonth}>
          <ChevronLeft />
        </Button>
        {format(date, "MMMM yyyy")}
        <Button variant="ghost" onClick={nextMonth}>
          <ChevronRight />
        </Button>
      </div>
      <h1>{budget?.name}</h1>
      <Form method="POST" className="flex max-w-xl flex-col items-start gap-4">
        <h2>Create category group</h2>
        <Input type="text" name="name" />
        <Button type="submit">Create</Button>
      </Form>
      <ul>
        {budget?.categoryGroups.map((categoryGroup) => (
          <li key={categoryGroup.name}>{categoryGroup.name}</li>
        ))}
      </ul>
    </div>
  );
}
