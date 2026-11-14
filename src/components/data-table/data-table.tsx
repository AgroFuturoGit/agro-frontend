"use client";

import { Fragment, type AriaAttributes, type ReactNode } from "react";
import {
  flexRender,
  type ColumnDef,
  type Row,
  type Table as ReactTableInstance,
} from "@tanstack/react-table";
import { FileX } from "lucide-react";

import { InlineAlert } from "@/components/ui/inline-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useIsMobile } from "@/hooks/use-mobile";

import { cellMetaClass, headerMetaClass } from "./column-meta";
import { DataTableStatus } from "./data-table-status";

const SKELETON_ROWS = 4;
const SKELETON_CARDS = 3;

// Superfície única de card do painel (mesma do `Card`): borda 1px, raio 12.
const SURFACE = "overflow-hidden rounded-xl border border-border bg-card";

/** 1ª coluna com recuo de 24px e última com 24px à direita (Figma 100:222). */
function edgePadding(index: number, count: number) {
  return cn(index === 0 && "pl-6", index === count - 1 && "pr-6");
}

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
  /**
   * Ação oferecida no estado vazio SEM filtro ativo (ex.: "Criar primeiro
   * plano"). Com filtro ativo, a ação é sempre "Limpar filtros".
   */
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  /**
   * Alternativa a `onEmptyAction` quando a ação de vazio é navegação (ex.:
   * "Novo plano" → `/admin/planos/novo`): vira um link real.
   */
  emptyActionHref?: string;
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
  emptyActionLabel,
  onEmptyAction,
  emptyActionHref,
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
      // InlineAlert destrutivo (role=alert) com "Tentar novamente": o erro
      // não pode parecer um estado vazio.
      return (
        <div className="p-4 whitespace-normal">
          <InlineAlert
            variant="destructive"
            action={
              onRetry ? { label: "Tentar novamente", onClick: onRetry } : undefined
            }
          >
            <p className="font-medium">Não foi possível carregar os dados.</p>
            {errorHint ? <p>{errorHint}</p> : null}
          </InlineAlert>
        </div>
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
        actionLabel={hasActiveFilters ? "Limpar filtros" : emptyActionLabel}
        onAction={hasActiveFilters ? onClearFilters : onEmptyAction}
        actionHref={hasActiveFilters ? undefined : emptyActionHref}
        actionVariant={hasActiveFilters ? "outline" : "default"}
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
              className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4"
            >
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))
        ) : hasError || rows.length === 0 ? (
          <div className={SURFACE}>
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
    <div className={SURFACE}>
      <Table>
        <TableHeader className="bg-card">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="h-12 hover:bg-transparent">
              {headerGroup.headers.map((header, headerIndex) => {
                const sorted = header.column.getIsSorted();
                const ariaSort: AriaAttributes["aria-sort"] = !header.column.getCanSort()
                  ? undefined
                  : sorted === "asc"
                    ? "ascending"
                    : sorted === "desc"
                      ? "descending"
                      : "none";

                return (
                  <TableHead
                    key={header.id}
                    aria-sort={ariaSort}
                    className={cn(
                      edgePadding(headerIndex, headerGroup.headers.length),
                      headerMetaClass(header.column.columnDef.meta),
                    )}
                  >
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
              <TableRow key={`skeleton-${rowIndex}`} className="h-12">
                {columns.map((__, cellIndex) => (
                  <TableCell
                    key={`skeleton-${rowIndex}-${cellIndex}`}
                    className={edgePadding(cellIndex, columns.length)}
                  >
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
              <TableRow key={row.id} className="h-12">
                {row.getVisibleCells().map((cell, cellIndex, cells) => (
                  <TableCell
                    key={cell.id}
                    className={cn(
                      edgePadding(cellIndex, cells.length),
                      cellMetaClass(cell.column.columnDef.meta),
                    )}
                  >
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
