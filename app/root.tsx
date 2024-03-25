import type {
  LinksFunction,
  LoaderFunctionArgs,
  MetaFunction,
  SerializeFrom,
} from "@remix-run/cloudflare";
import { json } from "@remix-run/cloudflare";
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useRouteError,
  useRouteLoaderData,
} from "@remix-run/react";
import { DrizzleError } from "drizzle-orm";
import { ApiError } from "generated-sources/gocardless";
import { getUserSession } from "./lib/auth.server";
import { flashSession } from "./lib/cookie.server";
import styles from "./tailwind.css";
import { Navbar } from "./components/ui/navbar";

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
  const flashSessionCookie = flashSession(args.context.env);
  const fSession = await flashSessionCookie.getSession(cookieHeader);
  const toast = fSession.get("error") || null;
  const user = await getUserSession(args);

  const headers = new Headers();
  headers.append(
    "Set-Cookie",
    await flashSessionCookie.commitSession(fSession),
  );

  return json(
    {
      toast,
      user,
    },
    {
      headers,
    },
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
        <div className="w-64">
          <Navbar />
        </div>
        <div className="ml-64 max-h-screen min-h-screen overflow-auto px-6">
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

  function getContent() {
    if (isRouteErrorResponse(error)) {
      return (
        <div>
          <h1>Route Error</h1>
          <pre>{JSON.stringify(error, null, 2)}</pre>
        </div>
      );
    }

    if (error instanceof DrizzleError) {
      return (
        <div>
          <h1>Drizzle Error</h1>
          <pre>{JSON.stringify(error, null, 2)}</pre>
        </div>
      );
    }

    if (error instanceof ApiError) {
      return (
        <div>
          <h1>API Error</h1>
          <pre>{JSON.stringify(error, null, 2)}</pre>
        </div>
      );
    }
    return <div>{JSON.stringify(error)}</div>;
  }

  return (
    <html>
      <head>
        <title>Error</title>
        <Meta />
        <Links />
      </head>
      <body>{getContent()}</body>
      <Scripts />
    </html>
  );
}

export type RootLoaderData = SerializeFrom<typeof loader>;

export function useRootData(): RootLoaderData | null {
  return (useRouteLoaderData("root") as RootLoaderData) ?? null;
}
