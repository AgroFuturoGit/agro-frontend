import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import NotFound from "./not-found";

describe("página 404", () => {
  afterEach(cleanup);

  it("mostra o título h1, o código e a explicação dentro do <main>", () => {
    render(<NotFound />);

    const main = screen.getByRole("main");
    const heading = screen.getByRole("heading", { level: 1, name: "Página não encontrada" });
    expect(main).toContainElement(heading);
    expect(main.textContent).toContain("Erro 404");
    expect(main.textContent).toContain(
      "O endereço que você tentou abrir não existe ou foi movido.",
    );
  });

  it("usa o EmptyState em superfície de card, com ícone decorativo", () => {
    const { container } = render(<NotFound />);

    const empty = container.querySelector('[data-slot="empty-state"]');
    expect(empty).not.toBeNull();
    expect(empty).toHaveAttribute("data-variant", "card");
    expect(empty?.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("'Voltar ao início' é um link primário para /", () => {
    render(<NotFound />);

    const link = screen.getByRole("link", { name: "Voltar ao início" });
    expect(link).toHaveAttribute("href", "/");
    expect(link.className).toContain("bg-primary");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("um único heading na página (só o h1)", () => {
    render(<NotFound />);

    expect(screen.getAllByRole("heading")).toHaveLength(1);
  });
});
