import type { ActionArgs, LoaderArgs } from "@remix-run/cloudflare";
import { redirect } from "@remix-run/cloudflare";
import { logout } from "~/lib/auth.server";

export async function action(args: ActionArgs) {
  return logout(args);
}

export async function loader(args: LoaderArgs) {
  await logout(args);
  return redirect("/");
}
