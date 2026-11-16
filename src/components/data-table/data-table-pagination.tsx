"use client";

import type { Table as ReactTableInstance } from "@tanstack/react-table";

import { PaginationBar } from "./pagination-bar";

/** Tamanhos de página oferecidos em "Itens por página:". */
export const PER_PAGE_OPTIONS = [10, 20, 30, 50];

/**
 * Listas curtas sem paginação no Figma (lista do técnico, seções do
 * agricultor) só mostram o rodapé acima do menor tamanho de página: assim a
 * troca de "Itens por página" nunca esconde o próprio seletor.
 */
export const PAGINATION_MIN_ROWS = PER_PAGE_OPTIONS[0];

/** `true` quando a lista curta passa do menor tamanho de página. */
export function needsPagination(rowCount: number): boolean {
  return rowCount > PAGINATION_MIN_ROWS;
}

type DataTablePaginationProps<TData> = {
  /** Instância já criada pelo chamador via `useReactTable` — nunca criada aqui. */
  table: ReactTableInstance<TData>;
  perPageOptions?: number[];
};

export function DataTablePagination<TData>({
  table,
  perPageOptions = PER_PAGE_OPTIONS,
}: DataTablePaginationProps<TData>) {
  const { pageIndex, pageSize } = table.getState().pagination;

  return (
    <PaginationBar
      pageIndex={pageIndex}
      pageCount={table.getPageCount()}
      total={table.getFilteredRowModel().rows.length}
      pageSize={pageSize}
      onPageChange={(index) => table.setPageIndex(index)}
      pageSizeOptions={perPageOptions}
      onPageSizeChange={(size) => table.setPageSize(size)}
    />
  );
}
