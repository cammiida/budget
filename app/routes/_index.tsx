import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { json, redirect } from "@remix-run/cloudflare";
import { Outlet, useLoaderData } from "@remix-run/react";

export async function loader(args: LoaderFunctionArgs) {
  const user = args.context.user;

  if (!user) {
    throw redirect("/auth/login");
  }

  return json({
    user,
  });
}

export default function Index() {
  const { user } = useLoaderData<typeof loader>();

  return (
    <div className="h-screen overflow-x-hidden">
      <p className="">Hello {user.displayName}</p>
      <Outlet />
    </div>
  );
}
