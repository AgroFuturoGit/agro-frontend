"use client";

import type { Table as ReactTableInstance } from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type DataTablePaginationProps<TData> = {
  /** Instância já criada pelo chamador via `useReactTable` — nunca criada aqui. */
  table: ReactTableInstance<TData>;
  perPageOptions?: number[];
};

export function DataTablePagination<TData>({
  table,
  perPageOptions = [10, 20, 30, 50],
}: DataTablePaginationProps<TData>) {
  const { pageIndex, pageSize } = table.getState().pagination;
  const total = table.getFilteredRowModel().rows.length;
  const from = total === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min(total, (pageIndex + 1) * pageSize);

  return (
    <nav
      aria-label="Paginação"
      className="flex flex-col gap-3 rounded-lg border bg-card px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between"
    >
      <p role="status" aria-live="polite">
        {total > 0 ? (
          <>
            Exibindo <strong className="text-foreground">{from}</strong>–
            <strong className="text-foreground">{to}</strong> de{" "}
            <strong className="text-foreground">{total}</strong>
          </>
        ) : (
          "Nenhum registro"
        )}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={!table.getCanPreviousPage()}
          onClick={() => table.previousPage()}
          aria-label="Página anterior"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="whitespace-nowrap font-medium text-foreground">
          Página {pageIndex + 1} de {Math.max(1, table.getPageCount())}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={!table.getCanNextPage()}
          onClick={() => table.nextPage()}
          aria-label="Próxima página"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="per-page-select">Itens por página:</label>
        <Select value={String(pageSize)} onValueChange={(v) => table.setPageSize(Number(v))}>
          <SelectTrigger id="per-page-select" size="sm" className="min-w-[68px]">
            <SelectValue>{(v) => v}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {perPageOptions.map((opt) => (
              <SelectItem key={opt} value={String(opt)}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </nav>
  );
}
