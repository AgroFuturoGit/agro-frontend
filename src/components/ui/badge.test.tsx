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
