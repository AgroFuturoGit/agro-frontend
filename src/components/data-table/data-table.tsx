"use client";

import type { AriaAttributes } from "react";
import {
  flexRender,
  type ColumnDef,
  type Table as ReactTableInstance,
} from "@tanstack/react-table";
import { AlertTriangle, FileX } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { DataTableStatus } from "./data-table-status";

const SKELETON_ROWS = 4;

type DataTableProps<TData, TValue> = {
  /** Instância já criada pelo chamador via `useReactTable` — nunca criada aqui. */
  table: ReactTableInstance<TData>;
  columns: ColumnDef<TData, TValue>[];
  isLoading?: boolean;
  hasError?: boolean;
  onRetry?: () => void;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  emptyTitle?: string;
  emptyHint?: string;
};

export function DataTable<TData, TValue>({
  table,
  columns,
  isLoading,
  hasError,
  onRetry,
  hasActiveFilters,
  onClearFilters,
  emptyTitle = "Nenhum registro cadastrado ainda.",
  emptyHint = "",
}: DataTableProps<TData, TValue>) {
  const rows = table.getRowModel().rows;

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table>
        <TableHeader className="bg-muted/40">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {headerGroup.headers.map((header) => {
                const sorted = header.column.getIsSorted();
                const ariaSort: AriaAttributes["aria-sort"] = !header.column.getCanSort()
                  ? undefined
                  : sorted === "asc"
                    ? "ascending"
                    : sorted === "desc"
                      ? "descending"
                      : "none";

                return (
                  <TableHead key={header.id} aria-sort={ariaSort}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: SKELETON_ROWS }).map((_, rowIndex) => (
              <TableRow key={`skeleton-${rowIndex}`}>
                {columns.map((__, cellIndex) => (
                  <TableCell key={`skeleton-${rowIndex}-${cellIndex}`}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : hasError ? (
            // Erro é checado ANTES de "vazio": uma falha de rede nunca pode
            // aparecer como "nenhum registro cadastrado".
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="p-0">
                <DataTableStatus
                  role="alert"
                  icon={AlertTriangle}
                  title="Não foi possível carregar os dados."
                  hint="Tente novamente em alguns instantes."
                  actionLabel="Tentar novamente"
                  onAction={onRetry}
                />
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="p-0">
                <DataTableStatus
                  icon={FileX}
                  title={
                    hasActiveFilters
                      ? "Nenhum resultado para os filtros aplicados."
                      : emptyTitle
                  }
                  hint={
                    hasActiveFilters ? "Tente ajustar ou limpar os filtros." : emptyHint
                  }
                  actionLabel={hasActiveFilters ? "Limpar filtros" : undefined}
                  onAction={hasActiveFilters ? onClearFilters : undefined}
                />
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
