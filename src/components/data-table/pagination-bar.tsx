"use client";

import { useId, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { moveFocusTo } from "@/lib/focus";

// Botões do grupo segmentado "< Página X de Y >": alvo de 32px, sem borda
// própria (o grupo desenha a borda e os separadores).
const PAGE_BUTTON_CLASS =
  "inline-flex size-control-sm items-center justify-center text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent motion-reduce:transition-none";

type PaginationBarProps = {
  /** Página atual, começando em 0. */
  pageIndex: number;
  /** Total de páginas; valores menores que 1 são exibidos como 1. */
  pageCount: number;
  /** Total de itens (já filtrados). */
  total: number;
  pageSize: number;
  /** Recebe o índice (base 0) da página de destino. */
  onPageChange: (pageIndex: number) => void;
  /** Com `onPageSizeChange`, mostra o seletor "Itens por página:". */
  pageSizeOptions?: number[];
  onPageSizeChange?: (pageSize: number) => void;
  /**
   * Nome acessível da `<nav>`. Dê um nome específico quando houver mais de
   * uma paginação na mesma tela (ex.: "Paginação dos alertas").
   */
  label?: string;
};

/**
 * Barra de paginação de apresentação (sem TanStack): "Exibindo X–Y de N",
 * "Página A de B", anterior/próxima e, opcionalmente, o seletor de itens por
 * página. Usada pelo `DataTablePagination` e pelos grids de cards.
 *
 * Quando o botão acionado vai ficar desabilitado (primeira ou última
 * página), o foco passa antes para o texto "Página A de B", para não cair no
 * `<body>` (WCAG 2.4.3).
 */
export function PaginationBar({
  pageIndex,
  pageCount,
  total,
  pageSize,
  onPageChange,
  pageSizeOptions,
  onPageSizeChange,
  label = "Paginação",
}: PaginationBarProps) {
  const perPageId = useId();
  const pageLabelRef = useRef<HTMLSpanElement>(null);
  const safePageCount = Math.max(1, pageCount);
  const from = total === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min(total, (pageIndex + 1) * pageSize);
  const canPrevious = pageIndex > 0;
  const canNext = pageIndex < safePageCount - 1;
  const showPageSize = pageSizeOptions !== undefined && onPageSizeChange !== undefined;

  const goTo = (target: number) => {
    // O botão que leva à borda fica desabilitado no próximo render.
    if (target <= 0 || target >= safePageCount - 1) {
      moveFocusTo(pageLabelRef.current);
    }
    onPageChange(target);
  };

  return (
    <nav
      aria-label={label}
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
            disabled={!canPrevious}
            onClick={() => goTo(pageIndex - 1)}
            aria-label="Página anterior"
          >
            <ChevronLeft className="size-3.5" aria-hidden="true" />
          </button>
          <span
            ref={pageLabelRef}
            className="flex items-center whitespace-nowrap border-x border-border bg-surface-subtle px-4 font-medium text-foreground-strong outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          >
            Página {pageIndex + 1} de {safePageCount}
          </span>
          <button
            type="button"
            className={PAGE_BUTTON_CLASS}
            disabled={!canNext}
            onClick={() => goTo(pageIndex + 1)}
            aria-label="Próxima página"
          >
            <ChevronRight className="size-3.5" aria-hidden="true" />
          </button>
        </div>
        {showPageSize && (
          <div className="flex items-center gap-2">
            <label htmlFor={perPageId}>Itens por página:</label>
            <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
              <SelectTrigger id={perPageId} size="sm" className="w-16">
                <SelectValue>{(v) => v}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((opt) => (
                  <SelectItem key={opt} value={String(opt)}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </nav>
  );
}
