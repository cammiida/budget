import type { SerializeFrom } from "@remix-run/cloudflare";
import { Link, NavLink } from "@remix-run/react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRightLeft,
  ChevronDown,
  LayoutList,
  LogOut,
  PieChart,
  PiggyBank,
  User,
} from "lucide-react";
import { useState } from "react";
import type { RouteParams } from "routes-gen";
import { route } from "routes-gen";
import type { GoogleSession } from "~/lib/cookie.server";
import { useRootData } from "~/root";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { Button } from "./button";
import { Separator } from "./separator";

type Route = {
  name: string;
  route: keyof RouteParams;
  icon: LucideIcon;
};
const ROUTES: Route[] = [
  {
    name: "Budget",
    route: route("/budgets"),
    icon: PieChart,
  },
  {
    name: "Banks",
    route: route("/banks"),
    icon: PiggyBank,
  },
  {
    name: "Transactions",
    route: route("/transactions"),
    icon: ArrowRightLeft,
  },
  {
    name: "Categories",
    route: route("/categories"),
    icon: LayoutList,
  },
];

export function Navbar() {
  const rootData = useRootData();
  const user = rootData?.user;

  const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);

  return (
    <aside
      id="default-sidebar"
      className="fixed left-0 top-0 z-40 h-dvh w-64"
      aria-label="Sidebar"
    >
      <div className="flex h-full flex-col overflow-y-auto bg-gray-50 dark:bg-gray-800">
        <Link
          to={route("/")}
          className="flex h-16 flex-none items-center bg-gray-100 p-4 text-2xl font-semibold rtl:space-x-reverse"
        >
          YoBu
        </Link>
        <Separator className="flex-none" />
        <div className="flex h-full flex-col justify-between font-medium">
          <ul className="space-y-2 px-3 py-4">
            {ROUTES.map((route) => (
              <RouteNavLink key={route.route} route={route} />
            ))}
          </ul>
          <div className="w-full justify-self-end bg-gray-100">
            {user && <UserMenu isOpen={isUserMenuOpen} user={user} />}
            <Separator />
            <Button
              variant="ghost"
              type="button"
              className="flex h-16 w-full items-center justify-between text-sm"
              aria-expanded="false"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            >
              <div className="flex items-center gap-2">
                <Avatar>
                  <AvatarImage src={user?.avatar} alt={user?.displayName} />
                  <AvatarFallback className="bg-slate-200">
                    {user?.displayName
                      .split(" ")
                      .map((it) => it[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                {user?.displayName}
              </div>
              <ChevronDown
                className={`justify-self-end transition-transform ${isUserMenuOpen && "rotate-180"}`}
              />
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}

function UserMenu({
  isOpen,
  user,
}: {
  isOpen: boolean;
  user: SerializeFrom<GoogleSession>;
}) {
  return (
    <>
      <div
        className={
          "relative list-none divide-gray-100 overflow-hidden text-base transition-[height]" +
          " " +
          (isOpen ? "h-52 " : "h-0 overflow-hidden")
        }
      >
        <Separator />
        <small className="block h-12 truncate px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
          {user?.email}
        </small>
        <Separator />
        <ul
          className="h-40 space-y-4 px-4 py-3"
          aria-labelledby="user-menu-button"
        >
          <RouteNavLink
            route={{ name: "Profile", route: route("/profile"), icon: User }}
          />
          <RouteNavLink
            route={{ name: "Log out", route: "/auth/logout", icon: LogOut }}
          />
        </ul>
      </div>
    </>
  );
}

function RouteNavLink({
  route: { name: routeName, route, icon: Icon },
}: {
  route: Route;
}) {
  return (
    <NavLink
      key={routeName}
      to={route}
      className="group flex items-center rounded-lg p-2 text-gray-900 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700"
    >
      <Icon className="h-5 w-5 text-gray-500 transition duration-75 group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-white" />
      <span className="ms-3">{routeName}</span>
    </NavLink>
  );
}
