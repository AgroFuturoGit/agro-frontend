"use client";

import type { Table as ReactTableInstance } from "@tanstack/react-table";
import { useId } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Botões do grupo segmentado "< Página X de Y >": alvo de 32px, sem borda
// própria (o grupo desenha a borda e os separadores).
const PAGE_BUTTON_CLASS =
  "inline-flex size-control-sm items-center justify-center text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent motion-reduce:transition-none";

type DataTablePaginationProps<TData> = {
  /** Instância já criada pelo chamador via `useReactTable` — nunca criada aqui. */
  table: ReactTableInstance<TData>;
  perPageOptions?: number[];
};

export function DataTablePagination<TData>({
  table,
  perPageOptions = [10, 20, 30, 50],
}: DataTablePaginationProps<TData>) {
  const perPageId = useId();
  const { pageIndex, pageSize } = table.getState().pagination;
  const total = table.getFilteredRowModel().rows.length;
  const from = total === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min(total, (pageIndex + 1) * pageSize);

  return (
    <nav
      aria-label="Paginação"
      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-xl border border-border bg-card px-6 py-4 text-sm text-muted-foreground"
    >
      <p role="status" aria-live="polite">
        {total > 0 ? (
          <>
            Exibindo{" "}
            <strong className="font-bold">
              {from}–{to} de {total}
            </strong>
          </>
        ) : (
          "Nenhum registro"
        )}
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <div className="inline-flex items-stretch overflow-hidden rounded-lg border border-border bg-card">
          <button
            type="button"
            className={PAGE_BUTTON_CLASS}
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
            aria-label="Página anterior"
          >
            <ChevronLeft className="size-3.5" aria-hidden="true" />
          </button>
          <span className="flex items-center whitespace-nowrap border-x border-border bg-surface-subtle px-4 font-medium text-foreground-strong">
            Página {pageIndex + 1} de {Math.max(1, table.getPageCount())}
          </span>
          <button
            type="button"
            className={PAGE_BUTTON_CLASS}
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
            aria-label="Próxima página"
          >
            <ChevronRight className="size-3.5" aria-hidden="true" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor={perPageId}>Itens por página:</label>
          <Select value={String(pageSize)} onValueChange={(v) => table.setPageSize(Number(v))}>
            <SelectTrigger id={perPageId} size="sm" className="w-16">
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
      </div>
    </nav>
  );
}
