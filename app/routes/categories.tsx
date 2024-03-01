import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  json,
} from "@remix-run/cloudflare";
import { Form, useFetcher, useLoaderData } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import { DbApi } from "~/lib/dbApi";
import { createCategory } from "~/lib/schema";

export async function loader({ context }: LoaderFunctionArgs) {
  const api = DbApi.create({ context });

  const categories = await api.getCategories();
  return json({ categories });
}

export async function action({ request, context }: ActionFunctionArgs) {
  const formData = await request.formData();
  const data = createCategory
    .omit({ userId: true })
    .parse(Object.fromEntries(formData));

  const createdCategory = await DbApi.create({ context }).createCategory(data);

  if (!createdCategory) {
    throw new Response("Failed to create category. Category already exists.", {
      status: 409,
    });
  }

  return json({ createdCategory });
}

export default function BankTransactions() {
  const { categories } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  return (
    <div className="flex flex-col gap-4">
      <Form method="POST" className="max-w-xl flex flex-col gap-4">
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
      <ul>
        {categories.map((category) => (
          <li key={category.id}>{category.name}</li>
        ))}
      </ul>
    </div>
  );
}
