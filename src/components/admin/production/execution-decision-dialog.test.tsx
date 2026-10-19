import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ExecutionDecisionDialog } from "@/components/admin/production/execution-decision-dialog";
import { ApiError } from "@/lib/api";
import {
  rejectProductionExecution,
  validateProductionExecution,
  type ProductionExecution,
} from "@/lib/production";

vi.mock("@/lib/production", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/production")>("@/lib/production");
  return {
    ...actual,
    validateProductionExecution: vi.fn(),
    rejectProductionExecution: vi.fn(),
  };
});

const EXECUTION: ProductionExecution = {
  id: "execution-1",
  productionPlanId: "plan-1",
  quantity: 12,
  quantityKg: 240,
  harvestedAt: "2026-05-10",
  status: "PENDING",
  notes: null,
  rejectionReason: null,
  validatedBy: null,
  validatedAt: null,
  createdAt: null,
  updatedAt: null,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderDialog(mode: "validate" | "reject") {
  const onDecided = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <ExecutionDecisionDialog
      mode={mode}
      execution={EXECUTION}
      unit="BOX"
      open
      onOpenChange={onOpenChange}
      onDecided={onDecided}
    />,
  );
  return { onDecided, onOpenChange };
}

describe("ExecutionDecisionDialog — validar (UNIT-003)", () => {
  it("pede confirmação, não mostra motivo e chama validate", async () => {
    vi.mocked(validateProductionExecution).mockResolvedValue(EXECUTION);
    const { onDecided, onOpenChange } = renderDialog("validate");

    expect(screen.getByRole("alertdialog", { name: "Validar apontamento" })).toBeTruthy();
    expect(screen.queryByLabelText(/Motivo/)).toBeNull();
    expect(validateProductionExecution).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Validar" }));

    await waitFor(() =>
      expect(validateProductionExecution).toHaveBeenCalledWith("execution-1"),
    );
    await waitFor(() => expect(onDecided).toHaveBeenCalledTimes(1));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("erro da API aparece no dialog e ele não fecha", async () => {
    vi.mocked(validateProductionExecution).mockRejectedValue(
      new ApiError(403, "Sem acesso a este apontamento.", null),
    );
    const { onDecided, onOpenChange } = renderDialog("validate");

    fireEvent.click(screen.getByRole("button", { name: "Validar" }));

    expect(await screen.findByText("Sem acesso a este apontamento.")).toBeTruthy();
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(onDecided).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

describe("ExecutionDecisionDialog — rejeitar (UNIT-003)", () => {
  it("motivo vazio é aceito e vai sem texto", async () => {
    vi.mocked(rejectProductionExecution).mockResolvedValue(EXECUTION);
    const { onDecided } = renderDialog("reject");

    expect(screen.getByLabelText("Motivo (opcional)")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Rejeitar" }));

    await waitFor(() => expect(rejectProductionExecution).toHaveBeenCalledTimes(1));
    expect(vi.mocked(rejectProductionExecution).mock.calls[0][0]).toBe("execution-1");
    expect(vi.mocked(rejectProductionExecution).mock.calls[0][1] ?? "").toBe("");
    await waitFor(() => expect(onDecided).toHaveBeenCalledTimes(1));
  });

  it("motivo preenchido é enviado", async () => {
    vi.mocked(rejectProductionExecution).mockResolvedValue(EXECUTION);
    renderDialog("reject");

    fireEvent.change(screen.getByLabelText("Motivo (opcional)"), {
      target: { value: "Data errada" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Rejeitar" }));

    await waitFor(() =>
      expect(rejectProductionExecution).toHaveBeenCalledWith("execution-1", "Data errada"),
    );
  });

  it("erro da API mantém o dialog aberto", async () => {
    vi.mocked(rejectProductionExecution).mockRejectedValue(
      new ApiError(409, "Apontamento já decidido.", null),
    );
    const { onDecided, onOpenChange } = renderDialog("reject");

    fireEvent.click(screen.getByRole("button", { name: "Rejeitar" }));

    expect(await screen.findByText("Apontamento já decidido.")).toBeTruthy();
    expect(screen.getByRole("alertdialog", { name: "Rejeitar apontamento" })).toBeTruthy();
    expect(onDecided).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
