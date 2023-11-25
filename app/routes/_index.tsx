import { LoaderArgs, json, redirect } from "@remix-run/cloudflare";
import { Outlet, useLoaderData } from "@remix-run/react";
import { eq } from "drizzle-orm";
import { getMe } from "~/lib/auth.server";
import { getDbFromContext } from "~/lib/db.service.server";
import { users } from "~/lib/schema";
import { Theme, useTheme } from "~/lib/theme-provider";

const LINKS = [
  {
    label: "Home",
    href: "/",
  },
];

export async function loader(args: LoaderArgs) {
  const db = getDbFromContext(args.context);
  const userSession = await getMe(args);
  const user = await db
    .select({
      id: users.id,
      email: users.email,
      avatar: users.avatar,
      name: users.name,
    })
    .from(users)
    .where(eq(users.email, userSession.email))
    .get();
  if (!user) {
    return redirect("/login");
  }

  return json({
    user,
  });
}

export default function Index() {
  const data = useLoaderData<typeof loader>();
  const [theme, setTheme] = useTheme();

  const toggleTheme = () => {
    setTheme((prevTheme) =>
      prevTheme === Theme.LIGHT ? Theme.DARK : Theme.LIGHT
    );
  };

  return (
    <>
      <div className="overflow-x-hidden h-screen">
        <button onClick={toggleTheme}>Toggle theme</button>
        <h1 className="text-white">HOME</h1>
        <Outlet />
      </div>
    </>
  );
}
