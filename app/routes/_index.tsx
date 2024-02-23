import { LoaderFunctionArgs, json, redirect } from "@remix-run/cloudflare";
import { Outlet, useLoaderData } from "@remix-run/react";
import { DbApi } from "~/lib/dbApi";

const LINKS = [
  {
    label: "Home",
    href: "/",
  },
];

export async function loader(args: LoaderFunctionArgs) {
  const user = args.context.session;

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
    <>
      <div className="overflow-x-hidden h-screen">
        <p className="">Hello {user.displayName}</p>
        <Outlet />
      </div>
    </>
  );
}
