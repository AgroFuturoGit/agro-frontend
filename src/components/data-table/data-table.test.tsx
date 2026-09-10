import { useState } from "react";
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DataTable } from "./data-table";
import { DataTableColumnHeader } from "./data-table-column-header";

// Fixture propositalmente genérico: nenhum tipo de entidade concreta do
// domínio aparece aqui, para provar que os componentes são reusáveis.
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
  {
    accessorKey: "label",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Rótulo" />,
  },
  {
    accessorKey: "category",
    header: "Categoria",
    enableSorting: false,
  },
];

type TestHostProps = {
  data?: Item[];
  isLoading?: boolean;
  hasError?: boolean;
  onRetry?: () => void;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
};

function TestHost({ data = ITEMS, ...rest }: TestHostProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  // O React Compiler pula a memoização de componentes que usam
  // `useReactTable` (a instância retorna funções que não podem ser
  // memoizadas com segurança) — é exatamente o comportamento desejado aqui.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return <DataTable table={table} columns={columns} {...rest} />;
}

function bodyLabels() {
  return screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => row.querySelectorAll("td")[0]?.textContent);
}

function sortableHeader() {
  return screen.getByRole("columnheader", { name: "Rótulo" });
}

describe("DataTable — renderização das linhas", () => {
  afterEach(cleanup);

  it("renderiza uma linha por item do fixture, na ordem original", () => {
    render(<TestHost />);

    expect(bodyLabels()).toEqual(["Carlos", "Ana", "Bruno"]);
    expect(screen.getByText("Gama")).toBeTruthy();
  });
});

describe("DataTable — ordenação por cabeçalho clicável", () => {
  afterEach(cleanup);

  it("alterna asc → desc → asc ao clicar no mesmo cabeçalho, nunca voltando a 'sem ordenação'", async () => {
    const user = userEvent.setup();
    render(<TestHost />);

    const button = screen.getByRole("button", { name: "Rótulo" });

    await user.click(button);
    expect(bodyLabels()).toEqual(["Ana", "Bruno", "Carlos"]);

    await user.click(button);
    expect(bodyLabels()).toEqual(["Carlos", "Bruno", "Ana"]);

    await user.click(button);
    expect(bodyLabels()).toEqual(["Ana", "Bruno", "Carlos"]);
  });

  it("reflete o estado real da ordenação no aria-sort do <th>", async () => {
    const user = userEvent.setup();
    render(<TestHost />);

    const button = screen.getByRole("button", { name: "Rótulo" });

    expect(sortableHeader().getAttribute("aria-sort")).toBe("none");

    await user.click(button);
    expect(sortableHeader().getAttribute("aria-sort")).toBe("ascending");

    await user.click(button);
    expect(sortableHeader().getAttribute("aria-sort")).toBe("descending");
  });

  it("não expõe aria-sort nem botão em coluna não ordenável", () => {
    render(<TestHost />);

    const header = screen.getByRole("columnheader", { name: "Categoria" });

    expect(header.getAttribute("aria-sort")).toBeNull();
    expect(screen.queryByRole("button", { name: "Categoria" })).toBeNull();
  });

  it("é ativável por teclado (Enter no botão focado), não só por clique de mouse", async () => {
    const user = userEvent.setup();
    render(<TestHost />);

    const button = screen.getByRole("button", { name: "Rótulo" });

    // O botão é um `<button type="button">` nativo, então a ativação por
    // Enter depende do comportamento nativo do elemento — que o jsdom não
    // sintetiza em `click` a partir de um `keydown` cru. É exatamente o
    // buraco que o `@testing-library/user-event` preenche: ele reproduz a
    // sequência que o browser dispara, incluindo o `click` resultante.
    // Assim o teste prova a ativação por teclado de verdade, em vez de
    // simular o clique final à mão e presumir o resto.
    await user.tab();
    expect(document.activeElement).toBe(button);

    await user.keyboard("{Enter}");
    expect(bodyLabels()).toEqual(["Ana", "Bruno", "Carlos"]);
    expect(sortableHeader().getAttribute("aria-sort")).toBe("ascending");
  });
});

describe("DataTable — estado de carregamento", () => {
  afterEach(cleanup);

  it("renderiza skeletons no lugar das linhas quando isLoading", () => {
    const { container } = render(<TestHost isLoading />);

    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBe(
      4 * columns.length,
    );
    expect(screen.queryByText("Carlos")).toBeNull();
  });
});

describe("DataTable — os três estados de DataTableStatus", () => {
  afterEach(cleanup);

  it("erro: anuncia com role='alert', oferece 'Tentar novamente' e nunca cai no texto de vazio", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<TestHost data={[]} hasError onRetry={onRetry} />);

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Não foi possível carregar os dados.");
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByText("Nenhum registro cadastrado ainda.")).toBeNull();
    expect(screen.queryByText("Nenhum resultado para os filtros aplicados.")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("vazio sem filtro ativo: role='status', mensagem de 'nenhum registro' e nenhuma ação", () => {
    render(<TestHost data={[]} />);

    const status = screen.getByRole("status");
    expect(status.textContent).toContain("Nenhum registro cadastrado ainda.");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Tentar novamente" })).toBeNull();
  });

  it("vazio com filtro ativo: mensagem distinta e ação 'Limpar filtros'", async () => {
    const user = userEvent.setup();
    const onClearFilters = vi.fn();
    render(<TestHost data={[]} hasActiveFilters onClearFilters={onClearFilters} />);

    const status = screen.getByRole("status");
    expect(status.textContent).toContain("Nenhum resultado para os filtros aplicados.");
    expect(status.textContent).toContain("Tente ajustar ou limpar os filtros.");
    expect(screen.queryByText("Nenhum registro cadastrado ainda.")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });
});
