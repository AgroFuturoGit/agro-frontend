import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PriorityBadge } from "./priority-badge";

describe("PriorityBadge", () => {
  afterEach(cleanup);

  it("prioritária: badge de categoria (outline) com estrela decorativa", () => {
    render(<PriorityBadge isPriority />);
    const badge = screen.getByText("Prioritária");
    expect(badge.getAttribute("data-slot")).toBe("badge");
    expect(badge.className).toMatch(/\bborder-border\b/);
    // Texto de 14px como no Figma (109:498).
    expect(badge.className).toMatch(/\btext-sm\b/);
    // Não é status: sem as cores semânticas de sucesso/atenção/erro.
    expect(badge.className).not.toMatch(/bg-(success|warning|destructive)/);
    const icon = badge.querySelector("svg");
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
  });

  it("não prioritária: traço visual e texto para leitor de tela", () => {
    const { container } = render(<PriorityBadge isPriority={false} />);
    expect(screen.getByText("Não prioritária").className).toMatch(/\bsr-only\b/);
    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toBe("—");
    expect(container.querySelector('[data-slot="badge"]')).toBeNull();
  });

  it("aceita className", () => {
    render(<PriorityBadge isPriority className="extra-classe" />);
    expect(screen.getByText("Prioritária").className).toMatch(/\bextra-classe\b/);
  });
});
