import { cleanup, render, screen } from "@testing-library/react";
import { Users } from "lucide-react";
import { afterEach, describe, expect, it } from "vitest";

import { KpiCard, KpiGrid } from "./kpi-card";
import { StatCard } from "./stat-card";

describe("KpiCard", () => {
  afterEach(cleanup);

  it("raiz é um Card (data-slot=card) e label/valor/dica são irmãos dentro do <dl>", () => {
    render(
      <KpiCard label="Agricultores assistidos" value="25" hint="10 em dia" icon={Users} />,
    );

    const label = screen.getByText("Agricultores assistidos");
    expect(label.tagName).toBe("DT");
    // Contrato usado pelos testes dos dashboards: o pai do label contém o valor.
    expect(label.parentElement?.tagName).toBe("DL");
    expect(label.parentElement?.textContent).toContain("25");
    expect(label.parentElement?.textContent).toContain("10 em dia");
    expect(label.closest("[data-slot=card]")).not.toBeNull();

    const value = screen.getByText("25");
    expect(value.tagName).toBe("DD");
    expect(value).toHaveClass("text-kpi", "font-bold", "tabular-nums", "text-foreground");
  });

  it("ícone é decorativo", () => {
    const { container } = render(<KpiCard label="Safras" value="3" icon={Users} />);

    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("valor vazio mostra '—' e anuncia 'sem dados'", () => {
    render(<KpiCard label="Produtividade média" value={null} />);

    const dd = screen.getByText("sem dados").closest("dd");
    expect(dd?.textContent).toContain("—");
    expect(screen.getByText("—")).toHaveAttribute("aria-hidden", "true");
  });

  it("zero não é tratado como vazio", () => {
    render(<KpiCard label="Agricultores ativos" value={0} />);

    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.queryByText("sem dados")).toBeNull();
  });

  it("highlight usa a variante de destaque do Card", () => {
    const { container } = render(<KpiCard label="Conclusão" value="80%" highlight />);

    expect(container.querySelector("[data-slot=card]")).toHaveAttribute(
      "data-variant",
      "highlight",
    );
  });

  it("loading: skeletons de label, ícone e número, sem <dl> e sem role=status", () => {
    const { container } = render(
      <KpiCard label="Safras em curso" value="3" icon={Users} loading />,
    );

    expect(container.querySelector("dl")).toBeNull();
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBe(3);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("loading com reserveHint reserva a linha da dica (mesma altura do pronto)", () => {
    const { container } = render(
      <KpiCard label="Agricultores" value={null} icon={Users} loading reserveHint />,
    );

    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBe(4);
  });

  it("loading com hint mas sem reserveHint não reserva nem mostra a dica", () => {
    const { container } = render(
      <KpiCard label="Agricultores" value="3" hint="em dia" icon={Users} loading />,
    );

    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBe(3);
    expect(screen.queryByText("em dia")).toBeNull();
  });

  it("KpiGrid: 2 colunas e 4 a partir de lg", () => {
    const { container } = render(
      <KpiGrid className="mt-4">
        <KpiCard label="A" value="1" />
      </KpiGrid>,
    );

    expect(container.firstElementChild).toHaveClass("grid-cols-2", "lg:grid-cols-4", "mt-4");
  });
});

describe("StatCard", () => {
  afterEach(cleanup);

  it("label sem caixa alta e valor grande tabular", () => {
    render(<StatCard label="Previsto" value="43,98 t" />);

    const label = screen.getByText("Previsto");
    expect(label.tagName).toBe("DT");
    expect(label.className).not.toMatch(/uppercase/);
    const value = screen.getByText("43,98 t");
    expect(value).toHaveClass("text-kpi", "font-bold", "tabular-nums", "text-foreground");
    expect(label.closest("[data-slot=card]")).toHaveClass("h-full");
  });

  it.each([
    ["positive", "text-success"],
    ["negative", "text-destructive"],
  ] as const)("tone %s só reforça a cor; o texto do valor é mantido", (tone, cls) => {
    render(<StatCard label="Diferença" value="-15,75 t" tone={tone} />);

    expect(screen.getByText("-15,75 t")).toHaveClass(cls);
  });

  it("loading: skeletons e nenhum valor", () => {
    const { container } = render(<StatCard label="Realizado" value="1 t" loading />);

    expect(screen.queryByText("1 t")).toBeNull();
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBe(2);
  });
});

describe("KpiCard/StatCard — contraste, escala e vazio (A11Y-1/5, UX-8)", () => {
  afterEach(cleanup);

  it("highlight: label e dica em subtle-foreground (contraste ≥ 4,5 sobre o verde-claro)", () => {
    render(<KpiCard label="Conclusão" value="80%" hint="meta 90%" highlight />);

    expect(screen.getByText("Conclusão")).toHaveClass("text-subtle-foreground");
    expect(screen.getByText("meta 90%")).toHaveClass("text-subtle-foreground");
    expect(screen.getByText("Conclusão").className).not.toMatch(/text-muted-foreground/);
  });

  it("sem highlight: label e dica continuam em muted-foreground", () => {
    render(<KpiCard label="Safras" value="3" hint="2 ativas" />);

    expect(screen.getByText("Safras")).toHaveClass("text-muted-foreground");
    expect(screen.getByText("2 ativas")).toHaveClass("text-muted-foreground");
  });

  it("escala: rótulo/dica 16px (text-base) ao lado do número text-kpi", () => {
    render(<KpiCard label="Safras" value="3" hint="2 ativas" />);

    expect(screen.getByText("Safras")).toHaveClass("text-base");
    expect(screen.getByText("2 ativas")).toHaveClass("text-base");
  });

  it("StatCard: rótulo 16px (text-base)", () => {
    render(<StatCard label="Previsto" value="1 t" />);

    expect(screen.getByText("Previsto")).toHaveClass("text-base");
  });

  it.each([null, undefined, ""])("StatCard vazio (%s) mostra '—' neutro e anuncia 'sem dados'", (empty) => {
    const { container } = render(
      <StatCard label="Diferença" value={empty} tone="negative" />,
    );

    const dd = screen.getByText("sem dados").closest("dd");
    expect(dd?.textContent).toContain("—");
    expect(screen.getByText("—")).toHaveAttribute("aria-hidden", "true");
    expect(dd).toHaveClass("text-foreground");
    expect(dd).not.toHaveClass("text-destructive");
    expect(container.querySelector("[data-slot=card]")).toHaveAttribute("data-tone", "default");
  });

  it("StatCard: 0 não é vazio", () => {
    render(<StatCard label="Diferença" value={0} />);

    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.queryByText("sem dados")).toBeNull();
  });
});

