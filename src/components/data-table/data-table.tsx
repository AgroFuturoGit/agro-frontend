"use client";

import { Fragment, type AriaAttributes, type ReactNode } from "react";
import {
  flexRender,
  type ColumnDef,
  type Row,
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
import { useIsMobile } from "@/hooks/use-mobile";

import { DataTableStatus } from "./data-table-status";

const SKELETON_ROWS = 4;
const SKELETON_CARDS = 3;

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
  errorHint?: string;
  /**
   * Quando informado, o `DataTable` alterna para um layout de cards em
   * viewport mobile (`useIsMobile()`), reaproveitando os mesmos três
   * estados (carregando, erro, vazio) do modo tabela. Telas que não
   * passarem esta prop continuam renderizando `<Table>` em qualquer
   * largura — é o que mantém o comportamento atual intacto por padrão.
   */
  renderMobileCard?: (row: Row<TData>) => ReactNode;
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
  errorHint = "Tente novamente em alguns instantes.",
  renderMobileCard,
}: DataTableProps<TData, TValue>) {
  const isMobile = useIsMobile();
  const rows = table.getRowModel().rows;
  const useCardLayout = isMobile && Boolean(renderMobileCard);

  // Extraído para ser reusado tal e qual nos dois modos (tabela e card) —
  // o JSX do modo tabela permanece byte a byte o mesmo de antes, só que
  // chamado via função em vez de inline, para não arriscar regressão
  // visual no desktop.
  function renderStatus() {
    if (hasError) {
      // Erro é checado ANTES de "vazio": uma falha de rede nunca pode
      // aparecer como "nenhum registro cadastrado".
      return (
        <DataTableStatus
          role="alert"
          icon={AlertTriangle}
          title="Não foi possível carregar os dados."
          hint={errorHint}
          actionLabel="Tentar novamente"
          onAction={onRetry}
        />
      );
    }
    return (
      <DataTableStatus
        icon={FileX}
        title={
          hasActiveFilters
            ? "Nenhum resultado para os filtros aplicados."
            : emptyTitle
        }
        hint={hasActiveFilters ? "Tente ajustar ou limpar os filtros." : emptyHint}
        actionLabel={hasActiveFilters ? "Limpar filtros" : undefined}
        onAction={hasActiveFilters ? onClearFilters : undefined}
      />
    );
  }

  if (useCardLayout) {
    return (
      <div className="flex flex-col gap-3">
        {isLoading ? (
          Array.from({ length: SKELETON_CARDS }).map((_, idx) => (
            <div
              key={`skeleton-card-${idx}`}
              className="flex flex-col gap-2 rounded-lg border bg-card p-4"
            >
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))
        ) : hasError || rows.length === 0 ? (
          <div className="overflow-hidden rounded-lg border bg-card">
            {renderStatus()}
          </div>
        ) : (
          rows.map((row) => (
            <Fragment key={row.id}>{renderMobileCard?.(row)}</Fragment>
          ))
        )}
      </div>
    );
  }

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
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="p-0">
                {renderStatus()}
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="p-0">
                {renderStatus()}
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
