import { useState } from "react";
import {
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DataTableToolbar } from "./data-table-toolbar";

// Fixture propositalmente genérico: nenhum tipo de entidade concreta do
// domínio aparece aqui, para provar que o componente é reusável.
type Item = {
  id: string;
  label: string;
  category: string;
};

const ITEMS: Item[] = [
  { id: "1", label: "Carlos", category: "Alfa" },
  { id: "2", label: "Ana", category: "Beta" },
  { id: "3", label: "Bruno", category: "Gama" },
];

const columns: ColumnDef<Item>[] = [
  { accessorKey: "label", header: "Rótulo" },
  { accessorKey: "category", header: "Categoria" },
];

const FILTERS = [
  {
    columnId: "category",
    label: "Categoria",
    options: [
      { value: "Alfa", label: "Alfa" },
      { value: "Beta", label: "Beta" },
      { value: "Gama", label: "Gama" },
    ],
  },
];

function TestHost() {
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  // Ver justificativa da supressão em data-table.test.tsx.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: ITEMS,
    columns,
    state: { globalFilter, columnFilters },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <>
      <DataTableToolbar table={table} filters={FILTERS} />
      <span data-testid="global-filter-debug">{globalFilter}</span>
      <span data-testid="category-filter-debug">
        {String(table.getColumn("category")?.getFilterValue() ?? "")}
      </span>
    </>
  );
}

function globalFilterDebug() {
  return screen.getByTestId("global-filter-debug").textContent;
}

function categoryFilterDebug() {
  return screen.getByTestId("category-filter-debug").textContent;
}

/** Item atualmente destacado no popup aberto do `Select`. */
function highlightedOption(): HTMLElement {
  const highlighted = screen
    .getAllByRole("option")
    .find((option) => option.getAttribute("data-highlighted") !== null);
  expect(highlighted).toBeTruthy();
  return highlighted as HTMLElement;
}

/**
 * O `Select` do `@base-ui/react` é portalizado e só confirma o item
 * DESTACADO — clique em item não destacado é ignorado no jsdom. Abrimos o
 * "Filtros" (revela o combobox), depois abrimos o combobox pelo teclado
 * (o valor atual já entra destacado) e caminhamos até o alvo antes de
 * confirmar com Enter.
 */
async function selectCategoryOption(label: string) {
  fireEvent.click(screen.getByRole("button", { name: /Filtros/ }));

  const trigger = screen.getByRole("combobox");
  trigger.focus();
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  fireEvent.keyUp(trigger, { key: "ArrowDown" });

  const target = await screen.findByRole("option", { name: label });
  const options = screen.getAllByRole("option");
  const from = options.indexOf(highlightedOption());
  const to = options.indexOf(target);

  const key = to > from ? "ArrowDown" : "ArrowUp";
  for (let step = 0; step < Math.abs(to - from); step += 1) {
    const current = highlightedOption();
    fireEvent.keyDown(current, { key });
    fireEvent.keyUp(current, { key });
  }

  const highlighted = document.activeElement as HTMLElement;
  fireEvent.keyDown(highlighted, { key: "Enter" });
  fireEvent.keyUp(highlighted, { key: "Enter" });
}

describe("DataTableToolbar — busca com debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("nao propaga para o globalFilter da tabela antes do debounce completar", () => {
    render(<TestHost />);

    const input = screen.getByPlaceholderText("Buscar…");
    fireEvent.change(input, { target: { value: "abc" } });

    act(() => {
      vi.advanceTimersByTime(499);
    });

    expect(globalFilterDebug()).toBe("");
  });

  it("propaga apos o debounce completar quando o valor tem 3+ caracteres", () => {
    render(<TestHost />);

    const input = screen.getByPlaceholderText("Buscar…");
    fireEvent.change(input, { target: { value: "abc" } });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(globalFilterDebug()).toBe("abc");
  });

  it("nao propaga quando o valor tem 1 ou 2 caracteres, mesmo apos o debounce completar", () => {
    render(<TestHost />);

    const input = screen.getByPlaceholderText("Buscar…");
    fireEvent.change(input, { target: { value: "ab" } });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(globalFilterDebug()).toBe("");
  });

  it("propaga string vazia (0 caracteres) apos limpar o campo", () => {
    render(<TestHost />);

    const input = screen.getByPlaceholderText("Buscar…");
    fireEvent.change(input, { target: { value: "abc" } });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(globalFilterDebug()).toBe("abc");

    fireEvent.change(input, { target: { value: "" } });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(globalFilterDebug()).toBe("");
  });
});

describe("DataTableToolbar — filtro por coluna via botao 'Filtros'", () => {
  afterEach(cleanup);

  it("esconde o Select por padrao e revela ao clicar em 'Filtros'", () => {
    render(<TestHost />);

    expect(screen.queryByRole("combobox")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Filtros/ }));

    expect(screen.getByRole("combobox")).toBeTruthy();
  });

  it("selecionar uma opcao chama setFilterValue na coluna certa", async () => {
    render(<TestHost />);

    await selectCategoryOption("Beta");

    await waitFor(() => expect(categoryFilterDebug()).toBe("Beta"));
  });
});

describe("DataTableToolbar — chips removiveis e botao Limpar", () => {
  afterEach(cleanup);

  it("chip de busca aparece ao digitar e some ao clicar no X, limpando o globalFilter", () => {
    render(<TestHost />);

    const input = screen.getByPlaceholderText("Buscar…");
    fireEvent.change(input, { target: { value: "abc" } });

    const chip = screen.getByRole("button", { name: /Busca: abc/ });
    expect(chip).toBeTruthy();

    fireEvent.click(chip);

    expect(screen.queryByRole("button", { name: /Busca: abc/ })).toBeNull();
    expect(globalFilterDebug()).toBe("");
  });

  it("chip de filtro de coluna aparece com filtro ativo e some ao clicar no X", async () => {
    render(<TestHost />);

    await selectCategoryOption("Beta");

    const chip = await screen.findByRole("button", { name: /Categoria: Beta/ });
    expect(chip).toBeTruthy();

    fireEvent.click(chip);

    expect(screen.queryByRole("button", { name: /Categoria: Beta/ })).toBeNull();
    expect(categoryFilterDebug()).toBe("");
  });

  it("botao 'Limpar' reseta a busca e todos os filtros de coluna", async () => {
    render(<TestHost />);

    const input = screen.getByPlaceholderText("Buscar…");
    fireEvent.change(input, { target: { value: "abc" } });

    await selectCategoryOption("Beta");
    await waitFor(() => expect(categoryFilterDebug()).toBe("Beta"));

    fireEvent.click(screen.getByRole("button", { name: "Limpar" }));

    expect((input as HTMLInputElement).value).toBe("");
    expect(globalFilterDebug()).toBe("");
    expect(categoryFilterDebug()).toBe("");
    expect(screen.queryByRole("button", { name: "Limpar" })).toBeNull();
  });
});
