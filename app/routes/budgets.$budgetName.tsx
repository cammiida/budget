import { json, redirect, type LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import { addMonths, format, startOfMonth } from "date-fns";
import { and, eq } from "drizzle-orm";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { route } from "routes-gen";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import { getDbFromContext } from "~/lib/db.service.server";
import { budgets } from "~/lib/schema";

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
  const budget = await db
    .select()
    .from(budgets)
    .where(and(eq(budgets.userId, user.id), eq(budgets.name, budgetName)))
    .get();

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
    </div>
  );
}
