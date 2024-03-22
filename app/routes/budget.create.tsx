import type { ActionFunctionArgs } from "@remix-run/cloudflare";
import { Form, redirect, useNavigate } from "@remix-run/react";
import { addMonths, format, isBefore, startOfDay } from "date-fns";
import { useState } from "react";
import { route } from "routes-gen";
import { z } from "zod";
import ClientOnly from "~/components/client-only";
import { Button } from "~/components/ui/button";
import DatePicker from "~/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { getDbFromContext } from "~/lib/db.service.server";
import { budgets } from "~/lib/schema";

export async function action({ request, context }: ActionFunctionArgs) {
  const user = context.user;
  if (!user) {
    return redirect(route("/auth/login"));
  }

  const schema = z
    .object({
      startDate: z.coerce.date(),
      endDate: z.coerce.date(),
    })
    .refine(
      ({ startDate, endDate }) =>
        !isBefore(startOfDay(endDate), startOfDay(startDate)),
      {
        message: "End date must be on or after start date",
        path: ["endDate"],
      },
    );

  const formData = await request.formData();
  const { startDate, endDate } = schema.parse(Object.fromEntries(formData));

  console.log({ startDate, endDate });

  const db = getDbFromContext(context);
  await db
    .insert(budgets)
    .values({ userId: user.id, endDate, startDate })
    .returning()
    .get();

  return redirect(route("/budget"));
}

export default function CreateBudget() {
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(addMonths(new Date(), 1));

  const navigate = useNavigate();

  function handleClose() {
    navigate(route("/budget"));
  }

  return (
    <ClientOnly>
      {() => (
        <Dialog open onOpenChange={handleClose}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a new budget</DialogTitle>
            </DialogHeader>
            <Form method="POST" className="flex flex-col gap-4">
              <input
                readOnly
                hidden
                name="startDate"
                value={format(startDate, "yyyy-MM-dd")}
              />
              <input
                readOnly
                hidden
                name="endDate"
                value={format(endDate, "yyyy-MM-dd")}
              />
              <div className="flex gap-4">
                <div className="flex flex-col gap-1">
                  <Label>From</Label>
                  <DatePicker date={startDate} setDate={setStartDate} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label>To</Label>
                  <DatePicker date={endDate} setDate={setEndDate} />
                </div>
              </div>
              <Button type="submit" className="self-start">
                Submit
              </Button>
            </Form>
          </DialogContent>
        </Dialog>
      )}
    </ClientOnly>
  );
}
