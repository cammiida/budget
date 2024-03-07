import {
  ActionFunctionArgs,
  AppLoadContext,
  LoaderFunctionArgs,
  json,
} from "@remix-run/cloudflare";
import { Form, useFetcher, useLoaderData } from "@remix-run/react";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import { DbApi } from "~/lib/dbApi";
import { createCategory } from "~/lib/schema";

export async function loader({ context }: LoaderFunctionArgs) {
  const api = DbApi.create({ context });

  const categories = await api.getCategories();
  return json({ categories });
}

async function createCategoryAction(
  formData: FormData,
  context: AppLoadContext
) {
  const data = createCategory
    .omit({ userId: true })
    .parse(Object.fromEntries(formData));

  const createdCategory = await DbApi.create({ context }).createCategory(data);

  if (!createdCategory) {
    return json(
      {
        success: false,
        error: "Failed to create category. Category already exists.",
      },
      { status: 409 }
    );
  }

  return json({ success: true, category: createdCategory });
}

async function deleteCategoryAction(
  formData: FormData,
  context: AppLoadContext
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

export default function BankTransactions() {
  const { categories } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  return (
    <div className="max-w-xl flex flex-col gap-4">
      <Form method="POST" className="flex flex-col gap-4">
        <input hidden readOnly name="intent" value="create" />
        <h2 className="text-lg">Create a new category</h2>
        <div>
          <label
            className="block text-gray-700 text-sm font-bold mb-2"
            htmlFor="name"
          >
            Category name
          </label>
          <input
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            type="text"
            name="name"
            placeholder="Category name"
            required
          />
        </div>
        <Button type="submit">Create Category</Button>
      </Form>
      <h1 className="text-xl">Categories</h1>
      <ul className="flex flex-col gap-2">
        {categories.map((category) => (
          <li key={category.id} className="flex">
            <span className="flex-grow">{category.name}</span>
            <Form method="POST">
              <input hidden readOnly name="intent" value="delete" />
              <input hidden readOnly name="id" value={category.id} />
              <Button variant="destructive">Delete</Button>
            </Form>
          </li>
        ))}
      </ul>
    </div>
  );
}