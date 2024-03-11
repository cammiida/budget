import type { PropsWithChildren } from "react";

export function DataCell({ children }: PropsWithChildren) {
  return <td className="p-4">{children}</td>;
}
