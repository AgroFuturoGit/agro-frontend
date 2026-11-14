import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Inbox } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  afterEach(cleanup);

  it("padrão: role=status com título e dica no mesmo nó, ícone decorativo", () => {
    const { container } = render(
      <EmptyState icon={Inbox} title="Nenhum registro cadastrado ainda." hint="Cadastre o primeiro." />,
    );

    const status = screen.getByRole("status");
    expect(status.textContent).toContain("Nenhum registro cadastrado ainda.");
    expect(status.textContent).toContain("Cadastre o primeiro.");
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("role=alert para erro/não encontrado", () => {
    render(<EmptyState role="alert" title="Plano não encontrado." />);

    expect(screen.getByRole("alert").textContent).toContain("Plano não encontrado.");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("headingLevel=h1 renderiza o título como heading de nível 1", () => {
    render(<EmptyState headingLevel="h1" title="Página não encontrada" />);

    expect(screen.getByRole("heading", { level: 1, name: "Página não encontrada" })).toBeInTheDocument();
  });

  it("ação com onClick vira botão", async () => {
    const onClick = vi.fn();
    render(<EmptyState title="Vazio" action={{ label: "Limpar filtros", onClick }} />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("ação com href vira link", () => {
    render(
      <EmptyState title="Página não encontrada" action={{ label: "Voltar ao início", href: "/" }} />,
    );

    expect(screen.getByRole("link", { name: "Voltar ao início" })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("sem ação, nenhum botão", () => {
    render(<EmptyState title="Vazio" />);

    expect(screen.queryByRole("button")).toBeNull();
  });

  it.each([
    ["card", "bg-card"],
    ["dashed", "border-dashed"],
  ] as const)("variante %s aplica %s", (variant, cls) => {
    render(<EmptyState title="Vazio" variant={variant} />);

    expect(screen.getByRole("status")).toHaveClass(cls);
  });
});
