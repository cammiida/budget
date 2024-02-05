import { LoaderArgs, json, redirect } from "@remix-run/cloudflare";
import { Outlet, useLoaderData } from "@remix-run/react";
import { getMe, logout } from "~/lib/auth.server";
import { Theme, useTheme } from "~/lib/theme-provider";

const LINKS = [
  {
    label: "Home",
    href: "/",
  },
];

export async function loader(args: LoaderArgs) {
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
        <p className="">Hello {user.displayName}</p>
        <button onClick={toggleTheme}>Toggle theme</button>
        <Outlet />
      </div>
    </>
  );
}
