import type { DataFunctionArgs } from "@remix-run/cloudflare";
import { authenticate } from "~/lib/auth.server";

export function loader(args: DataFunctionArgs) {
  return authenticate(args);
}
