import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PaginationBar } from "./pagination-bar";

function Host({ total = 25, pageSize = 9 }: { total?: number; pageSize?: number }) {
  const [pageIndex, setPageIndex] = useState(0);
  return (
    <PaginationBar
      pageIndex={pageIndex}
      pageCount={Math.ceil(total / pageSize)}
      total={total}
      pageSize={pageSize}
      onPageChange={setPageIndex}
    />
  );
}

const previousButton = () =>
  screen.getByRole("button", { name: "Página anterior" }) as HTMLButtonElement;
const nextButton = () =>
  screen.getByRole("button", { name: "Próxima página" }) as HTMLButtonElement;

describe("PaginationBar — textos", () => {
  afterEach(cleanup);

  it("mostra 'Exibindo 1–9 de 25' e 'Página 1 de 3' dentro de nav 'Paginação'", () => {
    render(<Host />);

    expect(screen.getByRole("navigation", { name: "Paginação" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Exibindo 1–9 de 25");
    expect(screen.getByText("Página 1 de 3", { exact: true })).toBeTruthy();
  });

  it("mostra 'Nenhum registro' e 'Página 1 de 1' sem itens", () => {
    render(<Host total={0} />);

    expect(screen.getByRole("status").textContent).toBe("Nenhum registro");
    expect(screen.getByText("Página 1 de 1", { exact: true })).toBeTruthy();
    expect(previousButton().disabled).toBe(true);
    expect(nextButton().disabled).toBe(true);
  });

  it("não mostra o seletor de itens por página sem as duas props opcionais", () => {
    const { rerender } = render(
      <PaginationBar pageIndex={0} pageCount={3} total={25} pageSize={10} onPageChange={() => {}} />,
    );
    expect(screen.queryByLabelText("Itens por página:", { exact: true })).toBeNull();

    rerender(
      <PaginationBar
        pageIndex={0}
        pageCount={3}
        total={25}
        pageSize={10}
        onPageChange={() => {}}
        pageSizeOptions={[10, 20]}
      />,
    );
    expect(screen.queryByLabelText("Itens por página:", { exact: true })).toBeNull();

    rerender(
      <PaginationBar
        pageIndex={0}
        pageCount={3}
        total={25}
        pageSize={10}
        onPageChange={() => {}}
        pageSizeOptions={[10, 20]}
        onPageSizeChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Itens por página:", { exact: true })).toBeTruthy();
  });
});

describe("PaginationBar — navegação e bordas", () => {
  afterEach(cleanup);

  it("desabilita 'Página anterior' na primeira página e 'Próxima página' na última", async () => {
    const user = userEvent.setup();
    render(<Host />);

    expect(previousButton().disabled).toBe(true);
    expect(nextButton().disabled).toBe(false);

    await user.click(nextButton());
    expect(screen.getByRole("status").textContent).toBe("Exibindo 10–18 de 25");
    expect(previousButton().disabled).toBe(false);

    await user.click(nextButton());
    expect(screen.getByText("Página 3 de 3", { exact: true })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Exibindo 19–25 de 25");
    expect(nextButton().disabled).toBe(true);
  });

  it("chama onPageChange com o índice de destino", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <PaginationBar pageIndex={1} pageCount={3} total={25} pageSize={9} onPageChange={onPageChange} />,
    );

    await user.click(nextButton());
    expect(onPageChange).toHaveBeenLastCalledWith(2);
    await user.click(previousButton());
    expect(onPageChange).toHaveBeenLastCalledWith(0);
  });
});

describe("PaginationBar — foco nas bordas", () => {
  afterEach(cleanup);

  it("ao chegar à última página pelo teclado, o foco vai para 'Página A de B' e não cai no body", async () => {
    const user = userEvent.setup();
    render(<Host />);

    nextButton().focus();
    await user.keyboard("{Enter}");
    // Página intermediária: o foco continua no botão.
    expect(document.activeElement).toBe(nextButton());

    await user.keyboard("{Enter}");
    const label = screen.getByText("Página 3 de 3", { exact: true });
    expect(nextButton().disabled).toBe(true);
    expect(document.activeElement).toBe(label);
    expect(document.activeElement).not.toBe(document.body);
    expect(label.getAttribute("tabindex")).toBe("-1");
  });

  it("ao voltar à primeira página, o foco vai para 'Página A de B' e não cai no body", async () => {
    const user = userEvent.setup();
    render(<Host total={12} />);

    nextButton().focus();
    await user.keyboard("{Enter}");
    expect(screen.getByText("Página 2 de 2", { exact: true })).toBeTruthy();

    previousButton().focus();
    await user.keyboard("{Enter}");
    const label = screen.getByText("Página 1 de 2", { exact: true });
    expect(previousButton().disabled).toBe(true);
    expect(document.activeElement).toBe(label);
    expect(document.activeElement).not.toBe(document.body);
  });
});
