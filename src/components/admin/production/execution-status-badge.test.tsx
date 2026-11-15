import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { ExecutionStatusBadge } from "./execution-status-badge";

describe("ExecutionStatusBadge", () => {
  it.each([
    ["PENDING", "Pendente", "warning"],
    ["VALIDATED", "Validado", "success"],
    ["REJECTED", "Rejeitado", "destructive"],
  ] as const)("%s usa o Badge semântico %s/%s e mantém data-status", (status, label, variant) => {
    render(<ExecutionStatusBadge status={status} />);
    const badge = screen.getByText(label).closest("[data-slot=badge]");
    expect(badge?.getAttribute("data-status")).toBe(status);
    expect(badge?.getAttribute("data-variant")).toBe(variant);
    expect(badge?.className).not.toMatch(/amber|green|red-/);
  });

  it("rejeitado mostra motivo e data da decisão", () => {
    render(
      <ExecutionStatusBadge
        status="REJECTED"
        rejectionReason="  Acima do esperado "
        decidedAt="2026-05-12"
      />,
    );
    expect(screen.getByText("Motivo: Acima do esperado")).toBeTruthy();
    expect(screen.getByText("Decidido em 12/05/2026")).toBeTruthy();
  });

  it("sem status mostra traço anunciado como 'sem dados'", () => {
    render(<ExecutionStatusBadge status={null} />);
    expect(screen.getByText("sem dados")).toBeTruthy();
  });
});
