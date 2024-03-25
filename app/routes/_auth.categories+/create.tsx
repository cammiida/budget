import type { ActionFunctionArgs } from "@remix-run/cloudflare";
import { Form, json, redirect, useNavigate, useSubmit } from "@remix-run/react";
import { useRef } from "react";
import { route } from "routes-gen";
import ClientOnly from "~/components/client-only";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import LinkButton from "~/components/ui/link-button";
import { requireUser } from "~/lib/auth.server";
import { getDbFromContext } from "~/lib/db.service.server";
import { categories, createCategory } from "~/lib/schema";

export async function action({ request, context }: ActionFunctionArgs) {
  const user = requireUser(context);
  const formData = await request.formData();

  const data = createCategory
    .omit({ userId: true })
    .parse(Object.fromEntries(formData));

  const db = getDbFromContext(context);
  const createdCategory = await db
    .insert(categories)
    .values({ ...data, userId: user.id })
    .onConflictDoNothing();

  if (!createdCategory) {
    return json(
      {
        success: false,
        error: "Failed to create category. Category already exists.",
      },
      { status: 409 },
    );
  }

  return redirect(route("/categories"));
}

export default function CreateCategory() {
  const navigate = useNavigate();
  const submit = useSubmit();
  const formRef = useRef<HTMLFormElement>(null);

  function handleClose() {
    navigate(route("/categories"));
  }

  return (
    <ClientOnly>
      {() => (
        <Dialog open onOpenChange={handleClose}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-lg">
                Suggested categories
              </DialogTitle>
            </DialogHeader>
            <div className="flex h-96 flex-col gap-4">
              <Form ref={formRef} method="POST" className="flex flex-col gap-4">
                <div className="flex flex-col gap-4">
                  <div>
                    <label
                      className="mb-2 block text-sm font-bold text-gray-700"
                      htmlFor="name"
                    >
                      Category name
                    </label>
                    <Input
                      type="text"
                      name="name"
                      placeholder="Category name"
                      required
                    />
                  </div>
                  <div>
                    <label
                      className="mb-2 block text-sm font-bold text-gray-700"
                      htmlFor="keywords"
                    >
                      Keywords
                    </label>
                    <Input
                      type="text"
                      name="keywords"
                      placeholder="Keywords (comma separated)"
                    />
                  </div>
                </div>
              </Form>
            </div>
            <DialogFooter className="sm:justify-start">
              <DialogClose asChild>
                <LinkButton variant="secondary" to={route("/categories")}>
                  Cancel
                </LinkButton>
              </DialogClose>
              <Button
                className="self-end"
                type="submit"
                onClick={() =>
                  submit(new FormData(formRef.current ?? undefined), {
                    method: "POST",
                  })
                }
              >
                Create Category
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </ClientOnly>
  );
}
