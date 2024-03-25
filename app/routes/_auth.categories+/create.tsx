import type { ActionFunctionArgs } from "@remix-run/cloudflare";
import { Form, json, redirect, useNavigate } from "@remix-run/react";
import { route } from "routes-gen";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import Modal from "~/components/ui/modal";
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
  return (
    <Modal
      isOpen
      onClose={() => navigate(route("/categories"))}
      title="Create category"
    >
      <Form method="POST" className="flex flex-col gap-4">
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
        <Button className="self-end" type="submit">
          Create Category
        </Button>
      </Form>
    </Modal>
  );
}
