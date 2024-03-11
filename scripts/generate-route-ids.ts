import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { z } from "zod";
import { $ } from "execa";

// We will use these Zod schemas to strongly type the
// output of `npx remix routes --json`
const RouteSchema = z.object({
  id: z.string(),
  file: z.string(),
  path: z.string().optional(),
});

type Route = z.infer<typeof RouteSchema> & {
  children?: Route[];
};

const Schema: z.ZodType<Route> = RouteSchema.extend({
  children: z.lazy(() => Schema.array()).optional(),
});

async function main() {
  // We run the script and get the stdout
  let { stdout } = await $`npx remix routes --json`;
  // We parse the JSON using Zod
  let routes = Schema.array().parse(JSON.parse(stdout));
  // We recursively iterate the routes to get the IDs
  let ids = routes.flatMap((route) => iteration(route));

  await writeFile(
    resolve("./route-ids.d.ts"),
    `export type RouteId = ${ids.map((id) => `"${id}"`).join(" | ")}`,
  );
}

main();

// This function receives a route, if it has no children
// it returns the ID, if it has it returns all the IDs
function iteration(route: Route): string | string[] {
  if (!route.children) return route.id;
  return [route.id, ...route.children.flatMap((child) => iteration(child))];
}
