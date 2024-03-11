import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
} from "@remix-run/cloudflare";
import { redirect } from "@remix-run/cloudflare";
import { Form } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import { authenticate } from "~/lib/auth.server";
import { flashSession } from "~/lib/cookie.server";

export async function action(args: ActionFunctionArgs) {
  const cookieHeader = args.request.headers.get("Cookie");
  const flashSessionCookie = flashSession(args.context.env);
  const fSession = await flashSessionCookie.getSession(cookieHeader);

  const user = await authenticate(args);
  if (!user) {
    fSession.flash(
      "error",
      "Uh oh! Login failed. Please check your email and password and try again.",
    );

    return redirect("/auth/login", {
      headers: {
        "Set-Cookie": await flashSessionCookie.commitSession(fSession),
      },
    });
  }
}

export async function loader({ context, request }: LoaderFunctionArgs) {
  if (context.user) {
    const redirectTo =
      new URL(request.url).searchParams.get("redirectTo") ?? "/";
    throw redirect(redirectTo); // TODO: finish this
  }

  return new Response(null);
}

export default function Index() {
  return (
    <section className="mt-10 flex flex-col gap-5 text-center">
      <h1 className="text-xl">Å nei, du er visst ikke logget inn 😬</h1>
      <Form method="post">
        <Button type="submit">Logg inn med Google</Button>
      </Form>
    </section>
  );
}
