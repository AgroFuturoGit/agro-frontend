import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Badge } from "./badge";

describe("Badge", () => {
  afterEach(cleanup);

  it("renderiza um <span> com o texto e data-slot=badge", () => {
    render(<Badge>Em conformidade</Badge>);

    const badge = screen.getByText("Em conformidade");
    expect(badge.tagName).toBe("SPAN");
    expect(badge).toHaveAttribute("data-slot", "badge");
  });

  it.each([
    ["success", "bg-success-muted", "text-success"],
    ["warning", "bg-warning-muted", "text-warning-strong"],
    ["destructive", "bg-destructive-muted", "text-destructive-strong"],
    ["info", "bg-info-muted", "text-info"],
    ["muted", "bg-muted", "text-foreground"],
  ] as const)("variante %s usa tokens semânticos (%s / %s)", (variant, bg, text) => {
    render(<Badge variant={variant}>Status</Badge>);

    const badge = screen.getByText("Status");
    expect(badge).toHaveClass(bg, text);
    expect(badge).toHaveAttribute("data-variant", variant);
    // Nenhuma cor crua da paleta do Tailwind.
    expect(badge.className).not.toMatch(/\b(amber|emerald|sky|green|yellow|red|gray)-\d{2,3}\b/);
  });

  it("repassa atributos arbitrários (data-status, data-severity) e className", () => {
    render(
      <Badge variant="warning" data-status="PENDING" className="extra">
        Pendente
      </Badge>,
    );

    const badge = screen.getByText("Pendente");
    expect(badge).toHaveAttribute("data-status", "PENDING");
    expect(badge).toHaveClass("extra");
  });

  it("aceita outro elemento via render (composição do base-ui, sem asChild)", () => {
    render(<Badge render={<a href="/admin" />}>Link</Badge>);

    expect(screen.getByRole("link", { name: "Link" })).toHaveAttribute("data-slot", "badge");
  });
});

describe("Badge — status × categoria (A11Y-6/13)", () => {
  afterEach(cleanup);

  it("success leva CircleCheck decorativo por padrão (status ≠ categoria)", () => {
    render(<Badge variant="success">Validado</Badge>);

    const badge = screen.getByText("Validado");
    const icon = badge.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon).toHaveAttribute("data-icon", "inline-start");
    expect(badge).toHaveTextContent(/^Validado$/);
  });

  it("icon={false} remove o ícone padrão; outras variantes não têm ícone", () => {
    render(
      <>
        <Badge variant="success" icon={false}>
          Sem ícone
        </Badge>
        <Badge variant="outline">Prioritária</Badge>
      </>,
    );

    expect(screen.getByText("Sem ícone").querySelector("svg")).toBeNull();
    expect(screen.getByText("Prioritária").querySelector("svg")).toBeNull();
  });

  it("outline/ghost como link não clareiam o texto no hover", () => {
    render(
      <>
        <Badge variant="outline" render={<a href="/a" />}>
          A
        </Badge>
        <Badge variant="ghost">B</Badge>
      </>,
    );

    expect(screen.getByText("A").className).not.toMatch(/hover:text-muted-foreground/);
    expect(screen.getByText("A")).toHaveClass("[a]:hover:text-foreground");
    expect(screen.getByText("B")).toHaveClass("hover:text-foreground");
  });
});

describe("status-variants — categorias em outline", () => {
  it("tipos de ocorrência (categoria) usam outline, nunca cor de status", async () => {
    const { CATEGORY_BADGE_VARIANT, OCCURRENCE_TYPE_VARIANT } = await import(
      "@/lib/status-variants"
    );

    expect(CATEGORY_BADGE_VARIANT).toBe("outline");
    expect(new Set(Object.values(OCCURRENCE_TYPE_VARIANT))).toEqual(new Set(["outline"]));
  });
});

