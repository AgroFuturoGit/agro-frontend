"use client";

import { Fragment, useId, useState, type AriaAttributes, type ReactNode } from "react";
import {
  flexRender,
  type ColumnDef,
  type Row,
  type Table as ReactTableInstance,
} from "@tanstack/react-table";
import { Inbox, SearchX } from "lucide-react";

import { InlineAlert } from "@/components/ui/inline-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { FOCUS_TARGET, withFocusMove } from "@/lib/focus";
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

// O contêiner recebe o foco por script (tabindex=-1) quando o botão de erro ou
// de vazio desmonta; o anel (`FOCUS_TARGET`) aparece só no teclado.

/** 1ª coluna com recuo de 24px e última com 24px à direita (Figma 100:222). */
function edgePadding(index: number, count: number) {
  return cn(index === 0 && "pl-6", index === count - 1 && "pr-6");
}

type DataTableProps<TData, TValue> = {
  /** Instância já criada pelo chamador via `useReactTable` — nunca criada aqui. */
  table: ReactTableInstance<TData>;
  /**
   * Nome do contêiner (`role="region"`), que recebe o foco quando o botão
   * de erro ou de vazio desmonta: o leitor anuncia onde o usuário está
   * (ex.: "Lista de usuários", A11Y-L6-3).
   */
  label?: string;
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
  label = "Lista de registros",
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

  // Fim do carregamento (M3): uma frase curta só na transição
  // carregando → pronto, com o total da lista ("12 registros carregados.").
  // Não muda ao filtrar/paginar (o "Exibindo…" da paginação já informa) e
  // fica vazia no erro (o InlineAlert anuncia) e no vazio (o EmptyState
  // tem role=status). Ajuste de estado durante a renderização, sem efeito.
  const [prevLoading, setPrevLoading] = useState(Boolean(isLoading));
  const [loadedMessage, setLoadedMessage] = useState("");
  if (Boolean(isLoading) !== prevLoading) {
    setPrevLoading(Boolean(isLoading));
    const total = table.getPrePaginationRowModel().rows.length;
    setLoadedMessage(
      !isLoading && !hasError && total > 0
        ? `${total} ${total === 1 ? "registro carregado" : "registros carregados"}.`
        : "",
    );
  }
  const liveMessage = isLoading ? "Carregando…" : loadedMessage;

  // "Tentar novamente", "Limpar filtros" e o CTA do vazio desmontam com a
  // nova carga ou com o primeiro registro: antes da ação, o foco vai para o
  // contêiner da tabela, que fica montado (A11Y-L2-R2-2, A11Y-L5-R2-1). No
  // CTA que abre um drawer, é para cá que o drawer devolve o foco ao fechar.
  const containerId = useId();
  const focusContainer = (action?: () => void) =>
    action ? withFocusMove(containerId, action) : undefined;

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
              onRetry
                ? { label: "Tentar novamente", onClick: withFocusMove(containerId, onRetry) }
                : undefined
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
        icon={hasActiveFilters ? SearchX : Inbox}
        title={
          hasActiveFilters
            ? "Nenhum resultado para os filtros aplicados."
            : emptyTitle
        }
        hint={hasActiveFilters ? "Tente ajustar ou limpar os filtros." : emptyHint}
        actionLabel={hasActiveFilters ? "Limpar filtros" : emptyActionLabel}
        onAction={focusContainer(hasActiveFilters ? onClearFilters : onEmptyAction)}
        actionHref={hasActiveFilters ? undefined : emptyActionHref}
        actionVariant={hasActiveFilters ? "outline" : "default"}
      />
    );
  }

  if (useCardLayout) {
    return (
      <div
        id={containerId}
        role="region"
        aria-label={label}
        className={cn("flex flex-col gap-3", FOCUS_TARGET)}
        aria-busy={isLoading ? true : undefined}
      >
        <span aria-live="polite" className="sr-only">
          {liveMessage}
        </span>
        {isLoading ? (
          Array.from({ length: SKELETON_CARDS }).map((_, idx) => (
            <div
              key={`skeleton-card-${idx}`}
              aria-hidden="true"
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
    <div
      id={containerId}
      role="region"
      aria-label={label}
      className={cn(SURFACE, FOCUS_TARGET)}
    >
      {/* aria-busy enquanto carrega e um status só para leitor de tela: os
          skeletons ficam ocultos e o carregamento é anunciado (A11Y-L2-5,
          A11Y-L2-R2-1). A região fica sempre montada para o anúncio ocorrer. */}
      <span aria-live="polite" className="sr-only">
        {liveMessage}
      </span>
      <Table aria-busy={isLoading ? true : undefined}>
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
              <TableRow key={`skeleton-${rowIndex}`} className="h-12" aria-hidden="true">
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
