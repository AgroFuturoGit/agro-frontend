import { useState } from "react";
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
} from "@tanstack/react-table";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DataTablePagination } from "./data-table-pagination";

// Fixture propositalmente genérico: nenhum tipo de entidade concreta do
// domínio aparece aqui, para provar que o componente é reusável.
type Item = {
  id: string;
  label: string;
};

const ITEMS: Item[] = Array.from({ length: 25 }, (_, i) => ({
  id: String(i + 1),
  label: `Item ${i + 1}`,
}));

const columns: ColumnDef<Item>[] = [
  { accessorKey: "label", header: "Rótulo" },
];

function TestHost() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  // Ver justificativa da supressão em data-table.test.tsx.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: ITEMS,
    columns,
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return <DataTablePagination table={table} />;
}

describe("DataTablePagination — resumo e navegação", () => {
  afterEach(cleanup);

  it("mostra o resumo 'Exibindo 1–10 de 25' na primeira página", () => {
    render(<TestHost />);

    const status = screen.getByRole("status");
    expect(status.textContent).toContain("Exibindo");
    expect(status.textContent).toContain("1");
    expect(status.textContent).toContain("10");
    expect(status.textContent).toContain("25");
  });

  it("avança e atualiza o resumo para '11–20' ao clicar em 'Próxima página'", () => {
    render(<TestHost />);

    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));

    const status = screen.getByRole("status");
    expect(status.textContent).toContain("11");
    expect(status.textContent).toContain("20");
    expect(screen.getByText("Página 2 de 3")).toBeTruthy();
  });

  it("desabilita 'Página anterior' na primeira página", () => {
    render(<TestHost />);

    const previous = screen.getByRole(
      "button",
      { name: "Página anterior" },
    ) as HTMLButtonElement;
    expect(previous.disabled).toBe(true);
  });

  it("desabilita 'Próxima página' na última página", () => {
    render(<TestHost />);

    const next = screen.getByRole("button", {
      name: "Próxima página",
    }) as HTMLButtonElement;
    fireEvent.click(next); // página 2
    fireEvent.click(next); // página 3 (última: 25 itens, 10 por página)

    expect(screen.getByText("Página 3 de 3")).toBeTruthy();
    expect(next.disabled).toBe(true);
  });

  it("troca itens por página via Select e reflete o novo tamanho na paginação", async () => {
    render(<TestHost />);

    // O `Select` do `@base-ui/react` é portalizado e só confirma o item
    // DESTACADO — clique em item não destacado é ignorado no jsdom. Abrimos
    // pelo teclado (o valor atual, "10", já entra destacado) e caminhamos
    // até o alvo antes de confirmar com Enter.
    const trigger = screen.getByRole("combobox");
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyUp(trigger, { key: "ArrowDown" });

    const target = await screen.findByRole("option", { name: "20" });
    const options = screen.getAllByRole("option");
    const highlightedOption = () =>
      options.find((option) => option.getAttribute("data-highlighted") !== null) as HTMLElement;
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

    await waitFor(() => expect(screen.getByText("Página 1 de 2")).toBeTruthy());
    const status = screen.getByRole("status");
    expect(status.textContent).toContain("20");
    expect(status.textContent).toContain("25");
  });
});
