import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { BackLink } from "./back-link";
import { PageHeader } from "./page-header";
import { SectionHeader } from "./section-header";

describe("PageHeader", () => {
  afterEach(cleanup);

  it("renderiza o título em <h2> (o <h1> é do shell) e a descrição", () => {
    render(<PageHeader title="Usuários" description="Gerencie os usuários do sistema." />);

    const heading = screen.getByRole("heading", { level: 2, name: "Usuários" });
    expect(heading).toHaveClass("text-page-title", "font-bold");
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    expect(screen.getByText("Gerencie os usuários do sistema.")).toBeInTheDocument();
  });

  it("mostra as ações à direita", () => {
    render(
      <PageHeader title="Usuários" actions={<button type="button">Novo usuário</button>} />,
    );

    expect(screen.getByRole("button", { name: "Novo usuário" })).toBeInTheDocument();
  });

  it("breadcrumb vem antes do link de retorno, que vem antes do título", () => {
    render(
      <PageHeader
        title="Milho"
        breadcrumb={[
          { label: "Organizações", href: "/admin/organizacoes" },
          { label: "Milho" },
        ]}
        back={{ href: "/admin/planos", label: "Voltar para planos" }}
      />,
    );

    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    const back = screen.getByRole("link", { name: "Voltar para planos" });
    const heading = screen.getByRole("heading", { level: 2, name: "Milho" });

    expect(back).toHaveAttribute("href", "/admin/planos");
    expect(nav.compareDocumentPosition(back) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(back.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("não renderiza breadcrumb vazio", () => {
    render(<PageHeader title="Safras" breadcrumb={[]} />);

    expect(screen.queryByRole("navigation", { name: "Breadcrumb" })).toBeNull();
  });

  it("loading: skeletons no lugar do título e da descrição", () => {
    const { container } = render(
      <PageHeader title="Milho" description="Safra 2024/2025" loading />,
    );

    expect(screen.queryByRole("heading", { name: "Milho" })).toBeNull();
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBe(2);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it("titleId: anel de foco só no teclado e o <h2> fica montado no loading", () => {
    const { rerender } = render(<PageHeader title="Relatórios" titleId="t" loading />);

    const loadingTitle = document.getElementById("t");
    expect(loadingTitle?.tagName).toBe("H2");
    expect(loadingTitle).toHaveAccessibleName("Carregando…");
    // A11Y-L6-R2-1: o alvo do foco não fica aria-busy (leitores omitiriam o conteúdo).
    expect(loadingTitle).not.toHaveAttribute("aria-busy");
    expect(loadingTitle).toHaveClass("focus-visible:ring-2", "focus-visible:ring-ring", "outline-none");
    expect(loadingTitle?.className).not.toMatch(/(^| )ring-2/);

    loadingTitle?.setAttribute("tabindex", "-1");
    loadingTitle?.focus();
    rerender(<PageHeader title="Relatórios" titleId="t" />);

    const title = screen.getByRole("heading", { level: 2, name: "Relatórios" });
    expect(title).toBe(loadingTitle);
    expect(document.activeElement).toBe(title);
  });

  it("sem titleId, o título não ganha classes de foco", () => {
    render(<PageHeader title="Usuários" />);

    expect(screen.getByRole("heading", { level: 2 }).className).not.toMatch(/focus-visible/);
  });

  it("aceita className", () => {
    const { container } = render(<PageHeader title="X" className="mb-2" />);

    expect(container.firstElementChild).toHaveClass("mb-2");
  });
});

describe("BackLink", () => {
  afterEach(cleanup);

  it("é um link (não botão) com seta decorativa", () => {
    render(<BackLink href="/admin/x">Voltar para planos</BackLink>);

    const link = screen.getByRole("link", { name: "Voltar para planos" });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/admin/x");
    expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("SectionHeader", () => {
  afterEach(cleanup);

  it("renderiza <h3> com o id informado, descrição e ação", () => {
    render(
      <section aria-labelledby="financing-title">
        <SectionHeader
          id="financing-title"
          title="Financiamentos"
          description="Pedidos de crédito do agricultor."
          actions={<button type="button">Novo financiamento</button>}
        />
      </section>,
    );

    const heading = screen.getByRole("heading", { level: 3, name: "Financiamentos" });
    expect(heading).toHaveAttribute("id", "financing-title");
    expect(screen.getByRole("region", { name: "Financiamentos" })).toBeInTheDocument();
    expect(screen.getByText("Pedidos de crédito do agricultor.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Novo financiamento" })).toBeInTheDocument();
  });
});

describe("PageHeader/BackLink — escala e foco (A11Y-2/5/17)", () => {
  afterEach(cleanup);

  it("descrição em 18px (text-lg): no máximo 2 degraus abaixo do título de 30px", () => {
    render(<PageHeader title="Usuários" description="Gerencie os usuários." />);

    expect(screen.getByText("Gerencie os usuários.")).toHaveClass("text-lg");
  });

  it("loading anuncia 'Carregando…' para leitor de tela", () => {
    render(<PageHeader title="Usuários" description="x" loading />);

    expect(screen.getByText("Carregando…")).toHaveClass("sr-only");
  });

  it("BackLink e link do breadcrumb têm anel de foco opaco com offset", () => {
    render(
      <PageHeader
        title="Plano"
        breadcrumb={[{ label: "Planos", href: "/admin/planos" }, { label: "Plano 1" }]}
        back={{ href: "/admin/planos", label: "Voltar para planos" }}
      />,
    );

    for (const name of ["Planos", "Voltar para planos"]) {
      const link = screen.getByRole("link", { name });
      expect(link).toHaveClass(
        "focus-visible:ring-2",
        "focus-visible:ring-ring",
        "focus-visible:ring-offset-2",
      );
      expect(link.className).not.toMatch(/ring-ring\/50/);
    }
  });
});

