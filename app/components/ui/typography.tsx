import type { PropsWithChildren } from "react";

export function LargeText({ children }: PropsWithChildren<{}>) {
  return <p className="text-lg font-semibold">{children}</p>;
}
