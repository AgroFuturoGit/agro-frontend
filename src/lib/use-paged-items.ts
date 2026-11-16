import { useCallback, useMemo, useState } from "react";

/** Itens por página dos grids de cards (sem seletor de tamanho). */
export const CARD_PAGE_SIZE = 9;

export type PagedItems<T> = {
  /** Itens da página atual. */
  pageItems: T[];
  /** Página atual, começando em 0 (sempre dentro do intervalo válido). */
  pageIndex: number;
  /** Total de páginas (no mínimo 1). */
  pageCount: number;
  /** Vai para a página indicada; índices fora do intervalo são limitados. */
  setPageIndex: (pageIndex: number) => void;
  /** Volta para a primeira página (ex.: ao trocar filtro ou safra). */
  reset: () => void;
  /** Total de itens da lista. */
  total: number;
  /** `true` só quando a lista passa de uma página. */
  showPagination: boolean;
};

/**
 * Paginação no cliente para grids de cards, de `pageSize` em `pageSize`
 * (9 por padrão). Quando a lista encolhe, a página atual é ajustada para a
 * última página válida. Combine com o `PaginationBar`.
 */
export function usePagedItems<T>(
  items: readonly T[],
  pageSize: number = CARD_PAGE_SIZE,
): PagedItems<T> {
  const [storedIndex, setStoredIndex] = useState(0);
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const lastIndex = pageCount - 1;

  // Ajuste durante o render (padrão do React para estado derivado de props):
  // a lista encolheu e a página guardada deixou de existir.
  if (storedIndex > lastIndex) {
    setStoredIndex(lastIndex);
  }
  const pageIndex = Math.min(storedIndex, lastIndex);

  const pageItems = useMemo(
    () => items.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
    [items, pageIndex, pageSize],
  );

  const setPageIndex = useCallback(
    (next: number) => setStoredIndex(Math.min(Math.max(0, next), lastIndex)),
    [lastIndex],
  );
  const reset = useCallback(() => setStoredIndex(0), []);

  return {
    pageItems,
    pageIndex,
    pageCount,
    setPageIndex,
    reset,
    total,
    showPagination: total > pageSize,
  };
}
