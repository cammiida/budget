import type { SerializeFrom } from "@remix-run/cloudflare";
import { Link, NavLink } from "@remix-run/react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRightLeft,
  ChevronDown,
  CreditCard,
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
import { Separator as DefaultSeparator } from "./separator";

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
    name: "Accounts",
    route: route("/accounts"),
    icon: CreditCard,
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
      className="fixed left-0 top-0 z-40 h-dvh w-64 bg-rose-500 text-white shadow-sm"
      aria-label="Sidebar"
    >
      <div className="flex h-full flex-col overflow-y-auto ">
        <Link
          to={route("/")}
          className="flex h-16 flex-none items-center p-4 text-2xl font-semibold rtl:space-x-reverse"
        >
          YourBudget
        </Link>
        <Separator />
        <div className="flex h-full flex-col justify-between font-medium">
          <ul className="space-y-2 px-3 py-4">
            {ROUTES.map((route) => (
              <RouteNavLink key={route.route} route={route} />
            ))}
          </ul>
          <div className="w-full justify-self-end ">
            {user && <UserMenu isOpen={isUserMenuOpen} user={user} />}
            <Separator />
            <Button
              variant="ghost"
              type="button"
              className="flex h-16 w-full items-center justify-between rounded-none text-sm hover:bg-rose-400 hover:text-white"
              aria-expanded="false"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            >
              <div className="flex items-center gap-2">
                <Avatar>
                  <AvatarImage src={user?.avatar} alt={user?.displayName} />
                  <AvatarFallback className="bg-blue-400">
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
          "relative list-none overflow-hidden text-base transition-[height]" +
          " " +
          (isOpen ? "h-52 " : "h-0 overflow-hidden")
        }
      >
        <Separator />
        <small className="block h-12 truncate px-4 py-3 text-sm">
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
            route={{ name: "Log out", route: "/logout", icon: LogOut }}
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
      className={({ isActive }) =>
        `${isActive && "bg-rose-600"} group flex items-center rounded-lg p-2  hover:bg-rose-400 `
      }
    >
      <Icon className="h-5 w-5 transition duration-75" />
      <span className="ms-3">{routeName}</span>
    </NavLink>
  );
}

function Separator() {
  return <DefaultSeparator className="bg-rose-400" />;
}
