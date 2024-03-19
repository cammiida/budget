import { ListFilter } from "lucide-react";
import type { PropsWithChildren } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export function DataTableFilter({ children }: PropsWithChildren) {
  return (
    <Popover>
      <PopoverTrigger>
        <div className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input p-0 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50">
          <ListFilter className=" h-4 w-4 " />
        </div>
      </PopoverTrigger>
      <PopoverContent>{children}</PopoverContent>
    </Popover>
  );
}
