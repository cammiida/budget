import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { authenticate } from "~/lib/auth.server";

export function loader(args: LoaderFunctionArgs) {
  return authenticate(args);
}
