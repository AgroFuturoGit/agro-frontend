import { useState } from "react";
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

  it("alterna asc → desc → asc ao clicar no mesmo cabeçalho, nunca voltando a 'sem ordenação'", () => {
    render(<TestHost />);

    const button = screen.getByRole("button", { name: "Rótulo" });

    fireEvent.click(button);
    expect(bodyLabels()).toEqual(["Ana", "Bruno", "Carlos"]);

    fireEvent.click(button);
    expect(bodyLabels()).toEqual(["Carlos", "Bruno", "Ana"]);

    fireEvent.click(button);
    expect(bodyLabels()).toEqual(["Ana", "Bruno", "Carlos"]);
  });

  it("reflete o estado real da ordenação no aria-sort do <th>", () => {
    render(<TestHost />);

    const button = screen.getByRole("button", { name: "Rótulo" });

    expect(sortableHeader().getAttribute("aria-sort")).toBe("none");

    fireEvent.click(button);
    expect(sortableHeader().getAttribute("aria-sort")).toBe("ascending");

    fireEvent.click(button);
    expect(sortableHeader().getAttribute("aria-sort")).toBe("descending");
  });

  it("não expõe aria-sort nem botão em coluna não ordenável", () => {
    render(<TestHost />);

    const header = screen.getByRole("columnheader", { name: "Categoria" });

    expect(header.getAttribute("aria-sort")).toBeNull();
    expect(screen.queryByRole("button", { name: "Categoria" })).toBeNull();
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

  it("erro: anuncia com role='alert', oferece 'Tentar novamente' e nunca cai no texto de vazio", () => {
    const onRetry = vi.fn();
    render(<TestHost data={[]} hasError onRetry={onRetry} />);

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Não foi possível carregar os dados.");
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByText("Nenhum registro cadastrado ainda.")).toBeNull();
    expect(screen.queryByText("Nenhum resultado para os filtros aplicados.")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
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

  it("vazio com filtro ativo: mensagem distinta e ação 'Limpar filtros'", () => {
    const onClearFilters = vi.fn();
    render(<TestHost data={[]} hasActiveFilters onClearFilters={onClearFilters} />);

    const status = screen.getByRole("status");
    expect(status.textContent).toContain("Nenhum resultado para os filtros aplicados.");
    expect(status.textContent).toContain("Tente ajustar ou limpar os filtros.");
    expect(screen.queryByText("Nenhum registro cadastrado ainda.")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });
});
