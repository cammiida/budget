import {
  LinksFunction,
  LoaderArgs,
  SerializeFrom,
  V2_MetaFunction,
  json,
} from "@remix-run/cloudflare";
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useRouteError,
  useRouteLoaderData,
} from "@remix-run/react";
import clsx from "clsx";
import { useEffect } from "react";
import { Navbar } from "./components/ui/navbar";
import { useToast } from "./components/ui/use-toast";
import { getUserSession } from "./lib/auth.server";
import { flashSession } from "./lib/cookie.server";
import { ThemeHead, ThemeProvider } from "./lib/theme-provider";
import { getThemeSession } from "./lib/theme.server";
import styles from "./tailwind.css";

export const links: LinksFunction = () => [{ rel: "stylesheet", href: styles }];

export const meta: V2_MetaFunction = () => {
  return [
    {
      title: "Remix Race Stack",
      image:
        "https://user-images.githubusercontent.com/43375532/235511500-8bb82094-8599-4dc3-84d9-3c2d128c4678.png",
      "og:image":
        "https://user-images.githubusercontent.com/43375532/235511500-8bb82094-8599-4dc3-84d9-3c2d128c4678.png",
    },
  ];
};

export async function loader(args: LoaderArgs) {
  const cookieHeader = args.request.headers.get("Cookie");
  const themeSession = await getThemeSession(args.request);
  const fSession = await flashSession.getSession(cookieHeader);
  const toast = fSession.get("toast") || null;
  const user = await getUserSession(args);

  const headers = new Headers();

  headers.append("Set-Cookie", await flashSession.commitSession(fSession));

  return json(
    {
      theme: themeSession.getTheme(),
      toast,
      ENV: {
        POSTHOG_API_KEY: args.context.POSTHOG_API_KEY, // TODO:
        POSTHOG_API_HOST: args.context.POSTHOG_API_HOST,
      },
      user,
    },
    {
      headers,
    }
  );
}

export default function App() {
  const data = useLoaderData<typeof loader>();
  const { toast } = useToast();

  useEffect(() => {
    if (data.toast) {
      toast(data.toast);
    }
  }, [data.toast]);

  return (
    <html lang="en">
      <ThemeProvider specifiedTheme={data.theme}>
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <Meta />
          <Links />
          <ThemeHead ssrTheme={Boolean(data.theme)} />
        </head>
        <body className={clsx(data.theme === "dark" ? "dark" : "light")}>
          <Navbar />
          <Outlet />
          <ScrollRestoration />
          <Scripts />
          <LiveReload />
        </body>
      </ThemeProvider>
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
