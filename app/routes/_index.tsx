import { LoaderFunctionArgs, json, redirect } from "@remix-run/cloudflare";
import { Outlet, useLoaderData } from "@remix-run/react";
import { getUserSession, logout } from "~/lib/auth.server";

const LINKS = [
  {
    label: "Home",
    href: "/",
  },
];

export async function loader(args: LoaderFunctionArgs) {
  const user = await getUserSession(args);

  if (!user) {
    await logout(args);
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
