import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { redirect } from "@remix-run/cloudflare";
import { route } from "routes-gen";

export async function loader(args: LoaderFunctionArgs) {
  console.log("index loader");
  const user = args.context.user;

  if (user) {
    throw redirect(route("/dashboard"));
  }

  return new Response(null, { status: 200 });
}

export default function Index() {
  return <div className="">Please log in</div>;
}
