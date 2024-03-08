import { Form, Link } from "@remix-run/react";
import { useState } from "react";
import { RouteParams, route } from "routes-gen";
import { useRootData } from "~/root";

const ROUTES: { name: string; route: keyof RouteParams }[] = [
  {
    name: "Budget",
    route: route("/budget"),
  },
  {
    name: "Banks",
    route: route("/banks"),
  },
  {
    name: "Transactions",
    route: route("/transactions"),
  },
  {
    name: "Categories",
    route: route("/categories"),
  },
];

export function Navbar() {
  const rootData = useRootData();
  const user = rootData?.user;

  const [isMenuOpen, setIsMenuOpen] = useState<{
    userMenu: boolean;
    mainMenu: boolean;
  }>({ userMenu: false, mainMenu: false });

  function toggleUserMenu() {
    setIsMenuOpen((prev) => ({ userMenu: !prev.userMenu, mainMenu: false }));
  }

  function toggleMainMenu() {
    setIsMenuOpen((prev) => ({ mainMenu: !prev.mainMenu, userMenu: false }));
  }

  return (
    <nav className="border-gray-200 bg-white dark:bg-gray-900">
      <div className="mx-auto flex max-w-screen-xl flex-wrap items-center justify-between p-4">
        <Link
          to={route("/")}
          className="flex items-center space-x-3 rtl:space-x-reverse"
        >
          <span className="self-center whitespace-nowrap text-2xl font-semibold dark:text-white">
            Your Budget App
          </span>
        </Link>
        <div className="flex items-center space-x-3 md:order-2 md:space-x-0 rtl:space-x-reverse">
          <button
            type="button"
            className="flex rounded-full bg-gray-800 text-sm focus:ring-4 focus:ring-gray-300 dark:focus:ring-gray-600 md:me-0"
            aria-expanded="false"
            onClick={toggleUserMenu}
          >
            <span className="sr-only">Open user menu</span>
            <img
              className="h-8 w-8 rounded-full"
              src={user?.avatar}
              alt={user?.displayName}
            />
          </button>
          <div
            className={
              "absolute right-5 top-12 z-50 my-4 list-none divide-y divide-gray-100 rounded-lg bg-white text-base shadow dark:divide-gray-600 dark:bg-gray-700" +
              (isMenuOpen.userMenu ? "" : " hidden")
            }
          >
            <div className="px-4 py-3">
              <span className="block text-sm text-gray-900 dark:text-white">
                {user?.displayName}
              </span>
              <span className="block truncate  text-sm text-gray-500 dark:text-gray-400">
                {user?.email}
              </span>
            </div>
            <ul className="py-2" aria-labelledby="user-menu-button">
              {ROUTES.map((it) => (
                <li key={it.route}>
                  <Link
                    to={it.route}
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-600 dark:hover:text-white"
                  >
                    {it.name}
                  </Link>
                </li>
              ))}
              <li>
                <Form method="post" action={route("/auth/logout")}>
                  <button
                    type="submit"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-600 dark:hover:text-white"
                  >
                    Sign out
                  </button>
                </Form>
              </li>
            </ul>
          </div>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg p-2 text-sm text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:text-gray-400 dark:hover:bg-gray-700 dark:focus:ring-gray-600 md:hidden"
            aria-controls="navbar-user"
            aria-expanded="false"
            onClick={toggleMainMenu}
          >
            <span className="sr-only">Open main menu</span>
            <svg
              className="h-5 w-5"
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 17 14"
            >
              <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M1 1h15M1 7h15M1 13h15"
              />
            </svg>
          </button>
        </div>
        <div
          className={
            "w-full items-center justify-between md:order-1 md:flex md:w-auto" +
            (isMenuOpen.mainMenu ? "" : " hidden")
          }
          id="navbar-user"
        >
          <ul className="mt-4 flex flex-col rounded-lg border border-gray-100 bg-gray-50 p-4 font-medium dark:border-gray-700 dark:bg-gray-800 md:mt-0 md:flex-row md:space-x-8 md:border-0 md:bg-white md:p-0 md:dark:bg-gray-900 rtl:space-x-reverse">
            {ROUTES.map((it) => (
              <li key={it.route}>
                <Link
                  to={it.route}
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-600 dark:hover:text-white"
                >
                  {it.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </nav>
  );
}
