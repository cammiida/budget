import {
  ActionFunctionArgs,
  AppLoadContext,
  LoaderFunctionArgs,
  SerializeFrom,
  json,
  redirect,
} from "@remix-run/cloudflare";
import { Form, useLoaderData } from "@remix-run/react";
import { route } from "routes-gen";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import { getDbFromContext } from "~/lib/db.service.server";
import { DbApi } from "~/lib/dbApi";
import { category, createCategory } from "~/lib/schema";

export async function loader({ context }: LoaderFunctionArgs) {
  const api = DbApi.create({ context });

  const categories = await api.getCategories();
  return json({ categories });
}

async function createCategoryAction(
  formData: FormData,
  context: AppLoadContext,
) {
  const data = createCategory
    .omit({ userId: true })
    .parse(Object.fromEntries(formData));

  const db = getDbFromContext(context);
  const userId = context.user?.id;
  if (!userId) {
    return redirect(route("/auth/login"));
  }

  const createdCategory = await db
    .insert(category)
    .values({ ...data, userId })
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

  return json({ success: true, category: createdCategory });
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

export async function action({ request, context }: ActionFunctionArgs) {
  const formData = await request.formData();
  const data = z
    .object({ intent: z.literal("create").or(z.literal("delete")) })
    .parse(Object.fromEntries(formData));

  return data.intent === "create"
    ? createCategoryAction(formData, context)
    : deleteCategoryAction(formData, context);
}

export default function Categories() {
  const { categories } = useLoaderData<typeof loader>();

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <Form method="POST" className="flex flex-col gap-4">
        <input hidden readOnly name="intent" value="create" />
        <h2 className="text-lg">Create a new category</h2>
        <div>
          <label
            className="mb-2 block text-sm font-bold text-gray-700"
            htmlFor="name"
          >
            Category name
          </label>
          <input
            className="focus:shadow-outline w-full appearance-none rounded border px-3 py-2 leading-tight text-gray-700 shadow focus:outline-none"
            type="text"
            name="name"
            placeholder="Category name"
            required
          />
          <input
            className="focus:shadow-outline w-full appearance-none rounded border px-3 py-2 leading-tight text-gray-700 shadow focus:outline-none"
            type="text"
            name="keywords"
            placeholder="Keywords (comma separated)"
            required
          />
        </div>
        <Button type="submit">Create Category</Button>
      </Form>
      <h1 className="text-xl">Categories</h1>
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
  return (
    <tr key={category.id} className="border border-slate-100">
      <td className="p-4">{category.name}</td>
      <td className="p-4">{category.keywords?.join(", ")}</td>
      <td className="p-4">
        <Form method="POST">
          <input hidden readOnly name="intent" value="delete" />
          <input hidden readOnly name="id" value={category.id} />
          <Button variant="destructive">Delete</Button>
        </Form>
      </td>
    </tr>
  );
}
