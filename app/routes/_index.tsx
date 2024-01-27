import { LoaderArgs, json, redirect } from "@remix-run/cloudflare";
import { Outlet, useLoaderData } from "@remix-run/react";
import { getMe, logout } from "~/lib/auth.server";
import { getDbFromContext } from "~/lib/db.service.server";
import { Theme, useTheme } from "~/lib/theme-provider";

const LINKS = [
  {
    label: "Home",
    href: "/",
  },
];

export async function loader(args: LoaderArgs) {
  const db = getDbFromContext(args.context);
  const user = await getMe(args);

  if (!user) {
    await logout(args);
    throw redirect("/login");
  }

  return json({
    user,
  });
}

export default function Index() {
  const { user } = useLoaderData<typeof loader>();
  const [theme, setTheme] = useTheme();

  const toggleTheme = () => {
    setTheme((prevTheme) =>
      prevTheme === Theme.LIGHT ? Theme.DARK : Theme.LIGHT
    );
  };

  return (
    <>
      <div className="overflow-x-hidden h-screen">
        <p className="text-white">Hello {user.name}</p>
        <button onClick={toggleTheme}>Toggle theme</button>
        <h1 className="text-white">HOME</h1>
        <Outlet />
      </div>
    </>
  );
}
