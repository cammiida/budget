import { ListFilter } from "lucide-react";
import type { PropsWithChildren } from "react";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export function DataTableFilter({ children }: PropsWithChildren) {
  return (
    <Popover>
      <PopoverTrigger>
        <Button className="h-8 w-8 p-0 lg:flex" variant="outline">
          <ListFilter className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent>{children}</PopoverContent>
    </Popover>
  );
}
