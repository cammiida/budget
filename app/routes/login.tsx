import { ActionArgs, LoaderArgs, redirect } from "@remix-run/cloudflare";
import { Form } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import { authenticate, getUserSession } from "~/lib/auth.server";
import { flashSession } from "~/lib/cookie.server";

export async function action(args: ActionArgs) {
  const cookieHeader = args.request.headers.get("Cookie");
  const fSession = await flashSession.getSession(cookieHeader);

  const user = await authenticate(args);
  if (!user) {
    fSession.flash("toast", {
      variant: "destructive",
      title: "Uh oh! Login failed.",
      description: "Please check your email and password and try again.",
    });

    return redirect("/login", {
      headers: {
        "Set-Cookie": await flashSession.commitSession(fSession),
      },
    });
  }
}

export async function loader(args: LoaderArgs) {
  const user = await getUserSession(args);

  if (user) {
    throw redirect("/");
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
