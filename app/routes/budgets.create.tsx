import type { ActionFunctionArgs } from "@remix-run/cloudflare";
import { Form, redirect, useNavigate } from "@remix-run/react";
import { route } from "routes-gen";
import { z } from "zod";
import ClientOnly from "~/components/client-only";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { getDbFromContext } from "~/lib/db.service.server";
import { budgets } from "~/lib/schema";

export async function action({ request, context }: ActionFunctionArgs) {
  const user = context.user;
  if (!user) {
    return redirect(route("/auth/login"));
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

export default function CreateBudget() {
  const navigate = useNavigate();

  function handleClose() {
    navigate(route("/budgets"));
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
              <Label htmlFor="name">Name</Label>
              <Input name="name" />

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
