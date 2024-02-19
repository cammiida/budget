import { AppLoadContext } from "@remix-run/cloudflare";

export type ServerArgs = {
  context: AppLoadContext;
  request: Request;
};
