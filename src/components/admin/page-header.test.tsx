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
