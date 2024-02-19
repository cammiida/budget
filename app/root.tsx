import {
  LinksFunction,
  LoaderFunctionArgs,
  MetaFunction,
  SerializeFrom,
  json,
} from "@remix-run/cloudflare";
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
  useRouteLoaderData,
} from "@remix-run/react";
import { Navbar } from "./components/ui/navbar";
import { getUserSession } from "./lib/auth.server";
import { flashSession } from "./lib/cookie.server";
import { GoCardlessApi } from "./lib/gocardless-api.server";
import styles from "./tailwind.css";

export const links: LinksFunction = () => [{ rel: "stylesheet", href: styles }];

export const meta: MetaFunction = () => {
  return [
    {
      title: "Camilla's Budget App",
    },
  ];
};

export async function loader(args: LoaderFunctionArgs) {
  const cookieHeader = args.request.headers.get("Cookie");
  const fSession = await flashSession.getSession(cookieHeader);
  const toast = fSession.get("error") || null;
  const user = await getUserSession(args);
  const goCardlessApi = await GoCardlessApi.create(args);
  await goCardlessApi.authorize();

  const headers = new Headers();
  headers.append("Set-Cookie", await flashSession.commitSession(fSession));
  headers.append("Set-Cookie", await goCardlessApi.commitSession());

  return json(
    {
      toast,
      user,
    },
    {
      headers,
    }
  );
}

export default function App() {
  // TODO: show flash message

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <Navbar />
        <div className="my-8 mx-6">
          <Outlet />
        </div>
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  console.error(error);

  return (
    <html>
      <head>
        <title>Oh no!</title>
        <Meta />
        <Links />
      </head>
      <body>
        <h1>Oh no!</h1>
        <p>Something went wrong.</p>
        <Scripts />
      </body>
    </html>
  );
}

export type RootLoaderData = SerializeFrom<typeof loader>;

export function useRootData(): RootLoaderData | null {
  return (useRouteLoaderData("root") as RootLoaderData) ?? null;
}
