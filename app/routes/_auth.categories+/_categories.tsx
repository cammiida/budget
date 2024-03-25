import type {
  ActionFunctionArgs,
  AppLoadContext,
  LoaderFunctionArgs,
  SerializeFrom,
} from "@remix-run/cloudflare";
import { json } from "@remix-run/cloudflare";
import { Form, Outlet, useLoaderData, useNavigate } from "@remix-run/react";
import { and, eq } from "drizzle-orm";
import { useState } from "react";
import { route } from "routes-gen";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { requireUser } from "~/lib/auth.server";
import { getDbFromContext } from "~/lib/db.service.server";
import { DbApi } from "~/lib/dbApi";
import { categories } from "~/lib/schema";

export async function loader({ context }: LoaderFunctionArgs) {
  const api = DbApi.create({ context });

  const categories = await api.getCategories();
  return json({ categories });
}

async function deleteCategoryAction(
  formData: FormData,
  context: AppLoadContext,
) {
  const data = z
    .object({ id: z.string().transform((arg) => Number(arg)) })
    .parse(Object.fromEntries(formData));

  try {
    const res = await DbApi.create({ context }).deleteCategory(data.id);
    if (res) {
      return json({ success: true });
    }
  } catch (error) {
    return json({ success: false, error }, { status: 400 });
  }
}

async function updateCategoryAction(
  formData: FormData,
  context: AppLoadContext,
) {
  const user = requireUser(context);
  const data = z
    .object({
      id: z.string().transform((arg) => Number(arg)),
      keywords: z.string().transform((arg) => arg.split(",")),
    })
    .parse(Object.fromEntries(formData));

  const db = getDbFromContext(context);
  await db
    .update(categories)
    .set({ keywords: data.keywords })
    .where(and(eq(categories.id, data.id), eq(categories.userId, user.id)));

  return json({ success: true });
}

export async function action({ request, context }: ActionFunctionArgs) {
  const formData = await request.formData();
  const data = z
    .object({
      intent: z.literal("delete").or(z.literal("update")),
    })
    .parse(Object.fromEntries(formData));

  switch (data.intent) {
    case "delete":
      return deleteCategoryAction(formData, context);
    case "update":
      return updateCategoryAction(formData, context);
  }
}

export default function Categories() {
  const { categories } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <Outlet />
      <div className="flex justify-between">
        <h1 className="text-xl">Categories</h1>
        <Button
          variant="secondary"
          onClick={() => navigate(route("/categories/create"))}
        >
          New category
        </Button>
      </div>
      <table className="w-full border">
        <tr className="border border-slate-100">
          <th className="bg-slate-100 p-4 text-left ">Name</th>
          <th className="bg-slate-100 p-4 text-left">Keywords</th>
          <th className="bg-slate-100 p-4 "></th>
        </tr>
        {categories.map((category) => (
          <CategoryRow key={category.id} category={category} />
        ))}
      </table>
    </div>
  );
}

type ClientCategory = SerializeFrom<typeof loader>["categories"][0];

function CategoryRow({ category }: { category: ClientCategory }) {
  const [keywordsInputValue, setKeywordsInputValue] = useState(
    category.keywords?.join(", "),
  );
  const hasChanged = keywordsInputValue !== category.keywords?.join(", ");

  return (
    <tr key={category.id} className="border border-slate-100">
      <td className="p-4">{category.name}</td>
      <td className="p-4">
        <Input
          value={keywordsInputValue}
          onChange={(e) => setKeywordsInputValue(e.currentTarget.value)}
        />
      </td>
      <td className="p-4">
        <Form method="POST">
          <input hidden readOnly name="intent" value="update" />
          <input hidden readOnly name="id" value={category.id} />
          <input hidden readOnly name="keywords" value={keywordsInputValue} />
          <Button disabled={!hasChanged}>Save</Button>
        </Form>
        <Form method="POST">
          <input hidden readOnly name="intent" value="delete" />
          <input hidden readOnly name="id" value={category.id} />
          <Button variant="destructive">Delete</Button>
        </Form>
      </td>
    </tr>
  );
}
