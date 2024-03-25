import type { PropsWithChildren } from "react";

type ActionHeaderProps = {
  title: string;
};

export default function ActionHeader({
  children,
  title,
}: PropsWithChildren<ActionHeaderProps>) {
  return (
    <div className="fixed top-0 z-50 flex h-16 w-[calc(100%-16rem)] items-center justify-between bg-white px-4 shadow-sm">
      <h1 className="text-lg font-semibold">{title}</h1>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}
