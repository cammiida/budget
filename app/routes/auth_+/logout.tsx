import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  redirect,
} from "@remix-run/cloudflare";
import { logout } from "~/lib/auth.server";

export async function action(args: ActionFunctionArgs) {
  return logout(args);
}

export async function loader(args: LoaderFunctionArgs) {
  await logout(args);
  return redirect("/");
}
