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

function TestHost({ extra }: { extra?: React.ReactNode } = {}) {
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
      <DataTableToolbar table={table} filters={FILTERS} extra={extra} />
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
 *
 * Mantido em `fireEvent` de propósito, mesmo com o `user-event` disponível
 * no projeto: o caminho depende de navegar item a item pelo DESTAQUE
 * interno do `@base-ui/react`, lendo `highlightedOption()` entre cada
 * tecla. O `user-event` entrega uma sequência de teclado mais fiel ao
 * browser, mas não dá esse controle passo a passo — e é ele que faz o
 * teste funcionar no jsdom.
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

// Este bloco fica em `fireEvent.change` em vez de `user.type`, por
// decisão: o alvo do teste é o LIMITE do debounce (499ms não propaga,
// 500ms propaga). `user.type` digita tecla a tecla e reinicia o debounce a
// cada caractere, o que embaralharia exatamente a fronteira sob teste. Uma
// única mudança de valor é o estímulo certo aqui.
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

  it("chip de busca aparece apos o debounce aplicar o filtro e some ao clicar no X, limpando o globalFilter", () => {
    vi.useFakeTimers();
    render(<TestHost />);

    const input = screen.getByPlaceholderText("Buscar…");
    fireEvent.change(input, { target: { value: "abc" } });

    // O chip reflete o filtro efetivamente aplicado (`table.getState().globalFilter`),
    // não o valor cru digitado — por isso precisa esperar o debounce completar.
    act(() => {
      vi.advanceTimersByTime(500);
    });

    const chip = screen.getByRole("button", { name: /Busca: abc/ });
    expect(chip).toBeTruthy();

    fireEvent.click(chip);

    expect(screen.queryByRole("button", { name: /Busca: abc/ })).toBeNull();
    expect(globalFilterDebug()).toBe("");

    vi.useRealTimers();
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

describe("DataTableToolbar — foco quando a linha de chips some (A11Y-L2-R2-2)", () => {
  afterEach(cleanup);

  it("'Limpar' leva o foco para a busca", async () => {
    render(<TestHost />);
    await selectCategoryOption("Beta");

    const limpar = await screen.findByRole("button", { name: "Limpar" });
    limpar.focus();
    fireEvent.click(limpar);

    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(screen.getByPlaceholderText("Buscar…"));
  });

  it("remover o último chip leva o foco para a busca", async () => {
    render(<TestHost />);
    await selectCategoryOption("Beta");

    const chip = await screen.findByRole("button", { name: /Categoria: Beta/ });
    chip.focus();
    fireEvent.click(chip);

    expect(document.activeElement).toBe(screen.getByPlaceholderText("Buscar…"));
  });

  // Dois chips: coluna (Categoria) + filtro extra.
  function TwoChipHost() {
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [onlyFlag, setOnlyFlag] = useState(true);
    // eslint-disable-next-line react-hooks/incompatible-library
    const table = useReactTable({
      data: ITEMS,
      columns,
      state: { columnFilters },
      onColumnFiltersChange: setColumnFilters,
      getCoreRowModel: getCoreRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
    });
    return (
      <DataTableToolbar
        table={table}
        filters={FILTERS}
        extraFilter={{
          active: onlyFlag,
          label: "Somente marcados",
          onClear: () => setOnlyFlag(false),
        }}
      />
    );
  }

  it("UX-L6-03: remover um chip que não é o último leva o foco ao chip seguinte", async () => {
    render(<TwoChipHost />);
    await selectCategoryOption("Beta");

    const chip = await screen.findByRole("button", { name: /Categoria: Beta/ });
    chip.focus();
    fireEvent.click(chip);

    expect(screen.queryByRole("button", { name: /Categoria: Beta/ })).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Remover filtro Somente marcados" }),
    );
  });

  it("UX-L6-03: remover o último chip da linha leva o foco ao chip anterior", async () => {
    render(<TwoChipHost />);
    await selectCategoryOption("Beta");

    const last = screen.getByRole("button", { name: "Remover filtro Somente marcados" });
    last.focus();
    fireEvent.click(last);

    expect(screen.queryByRole("button", { name: "Remover filtro Somente marcados" })).toBeNull();
    const previous = screen.getByRole("button", { name: /Categoria: Beta/ });
    expect(document.activeElement).toBe(previous);

    // Sobrou um só: removê-lo leva o foco para a busca.
    fireEvent.click(previous);
    expect(document.activeElement).toBe(screen.getByPlaceholderText("Buscar…"));
  });
});

describe("DataTableToolbar — slot extra (Lote 1B)", () => {
  afterEach(cleanup);

  it("renderiza o conteúdo de `extra` na mesma linha da busca e do 'Filtros'", () => {
    render(
      <TestHost
        extra={
          <label>
            <input type="checkbox" /> Somente prioritárias
          </label>
        }
      />,
    );

    const checkbox = screen.getByLabelText("Somente prioritárias");
    const filtros = screen.getByRole("button", { name: /Filtros/ });
    expect(checkbox.closest("label")?.parentElement).toBe(filtros.parentElement);
  });
});

describe("DataTableToolbar — acessibilidade (A11Y-2/9/12)", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("busca tem nome acessível próprio (não depende do placeholder)", () => {
    render(<TestHost />);

    const search = screen.getByRole("searchbox", { name: "Buscar" });
    expect(search).toHaveAttribute("aria-label", "Buscar");
    expect(search).toHaveAttribute("placeholder", "Buscar…");
  });

  it("chip anuncia a ação 'Remover filtro' e tem anel de foco opaco", () => {
    vi.useFakeTimers();
    render(<TestHost />);

    fireEvent.change(screen.getByPlaceholderText("Buscar…"), {
      target: { value: "abc" },
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    const chip = screen.getByRole("button", { name: "Remover filtro Busca: abc" });
    expect(chip).toHaveClass("focus-visible:ring-2", "focus-visible:ring-ring");
    expect(chip.className).not.toMatch(/ring-ring\/50/);
  });
});

describe("DataTableToolbar — chip de filtro de coluna (A11Y-12)", () => {
  afterEach(cleanup);

  it("nome do chip de coluna começa por 'Remover filtro' e mantém o texto visível", async () => {
    render(<TestHost />);

    await selectCategoryOption("Beta");

    const chip = await screen.findByRole("button", {
      name: "Remover filtro Categoria: Beta",
    });
    expect(chip).toHaveTextContent("Categoria: Beta");
  });
});

describe("DataTableToolbar — extraFilter (UX-23)", () => {
  afterEach(cleanup);

  function ExtraHost() {
    const [onlyFlag, setOnlyFlag] = useState(true);
    // eslint-disable-next-line react-hooks/incompatible-library
    const table = useReactTable({
      data: ITEMS,
      columns,
      getCoreRowModel: getCoreRowModel(),
    });
    return (
      <>
        <DataTableToolbar
          table={table}
          extraFilter={{
            active: onlyFlag,
            label: "Somente marcados",
            onClear: () => setOnlyFlag(false),
          }}
        />
        <span data-testid="extra-debug">{String(onlyFlag)}</span>
      </>
    );
  }

  it("filtro extra ativo gera chip e é limpo pelo 'Limpar'", () => {
    render(<ExtraHost />);

    expect(
      screen.getByRole("button", { name: "Remover filtro Somente marcados" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Limpar" }));
    expect(screen.getByTestId("extra-debug").textContent).toBe("false");
    expect(screen.queryByRole("button", { name: "Limpar" })).toBeNull();
  });

  it("o chip remove só o filtro extra", () => {
    render(<ExtraHost />);

    fireEvent.click(
      screen.getByRole("button", { name: "Remover filtro Somente marcados" }),
    );
    expect(screen.getByTestId("extra-debug").textContent).toBe("false");
  });
});
