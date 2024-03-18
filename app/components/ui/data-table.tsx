import type { HeaderContext, Table as TableType } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";

import { ArrowUpDown } from "lucide-react";
import type { PropsWithChildren } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Button } from "./button";
import { DataTablePagination } from "./data-table-pagination";

type DataTableProps<TData> = {
  table: TableType<TData>;
  pagination?: boolean;
};

export function DataTable<TData>({
  table,
  pagination,
  children,
}: PropsWithChildren<DataTableProps<TData>>) {
  return (
    <>
      <div className="flex items-center justify-end space-x-6 px-2 py-4 lg:space-x-8">
        {pagination && <DataTablePagination table={table} />}
        {children}
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => {
                    return (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={table.getAllColumns().length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

export function SortableHeaderCell<TData, TValue>({
  context: { column },
  name,
}: {
  context: HeaderContext<TData, TValue>;
  name: string;
}) {
  return (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {name}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  );
}
