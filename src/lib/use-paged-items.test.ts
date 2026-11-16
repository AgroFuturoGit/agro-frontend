import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { usePagedItems } from "./use-paged-items";

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe("usePagedItems", () => {
  afterEach(cleanup);

  it("pagina de 9 em 9 por padrão", () => {
    const { result } = renderHook(() => usePagedItems(range(20)));

    expect(result.current.pageItems).toEqual(range(9));
    expect(result.current.pageCount).toBe(3);
    expect(result.current.total).toBe(20);
    expect(result.current.showPagination).toBe(true);

    act(() => result.current.setPageIndex(2));
    expect(result.current.pageIndex).toBe(2);
    expect(result.current.pageItems).toEqual([19, 20]);
  });

  it("não mostra paginação com 9 itens ou menos", () => {
    expect(renderHook(() => usePagedItems(range(9))).result.current.showPagination).toBe(false);
    expect(renderHook(() => usePagedItems(range(3))).result.current.showPagination).toBe(false);

    const empty = renderHook(() => usePagedItems<number>([])).result.current;
    expect(empty.showPagination).toBe(false);
    expect(empty.pageCount).toBe(1);
    expect(empty.pageItems).toEqual([]);
  });

  it("mostra paginação com 10 itens", () => {
    const { result } = renderHook(() => usePagedItems(range(10)));
    expect(result.current.showPagination).toBe(true);
    expect(result.current.pageCount).toBe(2);
  });

  it("limita o índice ao intervalo válido", () => {
    const { result } = renderHook(() => usePagedItems(range(20)));

    act(() => result.current.setPageIndex(10));
    expect(result.current.pageIndex).toBe(2);

    act(() => result.current.setPageIndex(-1));
    expect(result.current.pageIndex).toBe(0);
  });

  it("ajusta para a última página válida quando a lista encolhe", () => {
    const { result, rerender } = renderHook(({ items }) => usePagedItems(items), {
      initialProps: { items: range(30) },
    });

    act(() => result.current.setPageIndex(3));
    expect(result.current.pageItems).toEqual([28, 29, 30]);

    rerender({ items: range(12) });
    expect(result.current.pageIndex).toBe(1);
    expect(result.current.pageCount).toBe(2);
    expect(result.current.pageItems).toEqual([10, 11, 12]);

    // A página guardada também foi ajustada: crescer de novo não volta à 4.
    rerender({ items: range(30) });
    expect(result.current.pageIndex).toBe(1);
  });

  it("reset volta para a primeira página", () => {
    const { result } = renderHook(() => usePagedItems(range(20)));

    act(() => result.current.setPageIndex(2));
    act(() => result.current.reset());

    expect(result.current.pageIndex).toBe(0);
    expect(result.current.pageItems).toEqual(range(9));
  });

  it("aceita outro tamanho de página", () => {
    const { result } = renderHook(() => usePagedItems(range(7), 3));
    expect(result.current.pageCount).toBe(3);
    expect(result.current.pageItems).toEqual([1, 2, 3]);
  });
});
