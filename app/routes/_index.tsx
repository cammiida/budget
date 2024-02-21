import { LoaderFunctionArgs, json } from "@remix-run/cloudflare";
import { Outlet, useLoaderData } from "@remix-run/react";
import { DbApi } from "~/lib/dbApi";

const LINKS = [
  {
    label: "Home",
    href: "/",
  },
];

export async function loader(args: LoaderFunctionArgs) {
  const user = await DbApi.create(args).requireUser();

  return json({
    user,
  });
}

export default function Index() {
  const { user } = useLoaderData<typeof loader>();

  return (
    <>
      <div className="overflow-x-hidden h-screen">
        <p className="">Hello {user.name}</p>
        <Outlet />
      </div>
    </>
  );
}
