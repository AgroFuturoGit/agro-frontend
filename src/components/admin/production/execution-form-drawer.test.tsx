import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExecutionFormDrawer } from "@/components/admin/production/execution-form-drawer";
import { ApiError } from "@/lib/api";
import type { Crop } from "@/lib/crops";
import {
  createProductionExecution,
  updateProductionExecution,
  type ProductionExecution,
} from "@/lib/production";

vi.mock("@/lib/production", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/production")>("@/lib/production");
  return {
    ...actual,
    createProductionExecution: vi.fn(),
    updateProductionExecution: vi.fn(),
  };
});

const BOX: Crop = {
  id: "c-1",
  name: "Tomate",
  variety: "Italiano",
  isPriority: false,
  cycleDays: null,
  expectedProductivity: 1500,
  harvestType: "CONTINUOUS",
  unit: "BOX",
  unitWeightKg: 20,
};

const EXECUTION: ProductionExecution = {
  id: "e-1",
  productionPlanId: "plan-1",
  quantity: 12,
  quantityKg: 240,
  harvestedAt: "2026-05-10",
  status: "VALIDATED",
  notes: null,
  createdAt: null,
  rejectionReason: null,
  validatedBy: null,
  validatedAt: null,
  updatedAt: "2026-05-10T08:30:00.123",
};

function renderForm(
  mode: "create" | "edit",
  crop: Crop | null,
  execution?: ProductionExecution,
) {
  const onSaved = vi.fn();
  render(
    <ExecutionFormDrawer
      mode={mode}
      planId="plan-1"
      crop={crop}
      open
      onOpenChange={vi.fn()}
      onSaved={onSaved}
      execution={execution}
    />,
  );
  return { onSaved };
}

function submit() {
  fireEvent.submit(document.querySelector("form") as HTMLFormElement);
}

beforeEach(() => {
  vi.mocked(createProductionExecution).mockReset();
  vi.mocked(updateProductionExecution).mockReset();
});
afterEach(() => cleanup());

describe("ExecutionFormDrawer — conversão (UNIT-011 / AC-012)", () => {
  it("cultura BOX de 20 kg: 12 caixas mostram 240 kg e enviam quantity/quantityKg", async () => {
    vi.mocked(createProductionExecution).mockResolvedValue(EXECUTION);
    const { onSaved } = renderForm("create", BOX);

    const quantity = await screen.findByLabelText("Quantidade colhida (caixas)");
    const preview = screen.getByLabelText("Peso em kg") as HTMLInputElement;
    expect(preview.readOnly).toBe(true);
    expect(preview.value).toBe("—");

    fireEvent.change(quantity, { target: { value: "12" } });
    expect(preview.value).toBe("240 kg");

    fireEvent.change(screen.getByLabelText("Data da colheita"), {
      target: { value: "2026-05-10" },
    });
    submit();

    await waitFor(() =>
      expect(createProductionExecution).toHaveBeenCalledWith("plan-1", {
        quantity: 12,
        quantityKg: 240,
        harvestedAt: "2026-05-10",
        notes: null,
      }),
    );
    expect(onSaved).toHaveBeenCalled();
  });

  it("TON multiplica por 1000 e cultura sem unidade (legado) é tratada como kg", async () => {
    renderForm("create", { ...BOX, unit: "TON", unitWeightKg: 1000 });
    fireEvent.change(await screen.findByLabelText("Quantidade colhida (t)"), {
      target: { value: "1.5" },
    });
    expect((screen.getByLabelText("Peso em kg") as HTMLInputElement).value).toBe("1.500 kg");
    cleanup();

    renderForm("create", { ...BOX, unit: null, unitWeightKg: null });
    fireEvent.change(await screen.findByLabelText("Quantidade colhida (kg)"), {
      target: { value: "7" },
    });
    expect((screen.getByLabelText("Peso em kg") as HTMLInputElement).value).toBe("7 kg");
  });
});

describe("ExecutionFormDrawer — sem peso (UNIT-012 / AC-013)", () => {
  it("SACK/BOX sem unitWeightKg bloqueia com a mensagem da BR-008", async () => {
    renderForm("create", { ...BOX, unit: "SACK", unitWeightKg: null });
    expect(
      await screen.findByText(
        "Cadastre o peso da unidade na cultura antes de registrar apontamentos",
      ),
    ).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Salvar" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.change(screen.getByLabelText("Quantidade colhida (sacas)"), {
      target: { value: "3" },
    });
    fireEvent.change(screen.getByLabelText("Data da colheita"), {
      target: { value: "2026-05-10" },
    });
    submit();
    expect(createProductionExecution).not.toHaveBeenCalled();
  });
});

describe("ExecutionFormDrawer — payload sem status (UNIT-013 / AC-014)", () => {
  it("criar e editar nunca enviam status, validatedBy nem validatedAt", async () => {
    vi.mocked(createProductionExecution).mockResolvedValue(EXECUTION);
    vi.mocked(updateProductionExecution).mockResolvedValue(EXECUTION);

    renderForm("create", BOX);
    fireEvent.change(await screen.findByLabelText("Quantidade colhida (caixas)"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText("Data da colheita"), {
      target: { value: "2026-05-11" },
    });
    fireEvent.change(screen.getByLabelText("Observações"), { target: { value: " lote A " } });
    submit();
    await waitFor(() => expect(createProductionExecution).toHaveBeenCalled());
    cleanup();

    renderForm("edit", BOX, EXECUTION);
    fireEvent.change(await screen.findByLabelText("Quantidade colhida (caixas)"), {
      target: { value: "13" },
    });
    submit();
    await waitFor(() => expect(updateProductionExecution).toHaveBeenCalled());

    for (const call of [
      vi.mocked(createProductionExecution).mock.calls[0][1],
      vi.mocked(updateProductionExecution).mock.calls[0][1],
    ]) {
      expect(call).not.toHaveProperty("status");
      expect(call).not.toHaveProperty("validatedBy");
      expect(call).not.toHaveProperty("validatedAt");
    }
    expect(vi.mocked(createProductionExecution).mock.calls[0][1].notes).toBe("lote A");
    expect(vi.mocked(updateProductionExecution).mock.calls[0]).toEqual([
      "e-1",
      {
        quantity: 13,
        quantityKg: 260,
        harvestedAt: "2026-05-10",
        notes: null,
        baseUpdatedAt: "2026-05-10T08:30:00.123",
      },
    ]);
    // Criação não tem versão anterior.
    expect(vi.mocked(createProductionExecution).mock.calls[0][1]).not.toHaveProperty(
      "baseUpdatedAt",
    );
  });
});

describe("ExecutionFormDrawer — edição concorrente (CR-002)", () => {
  it("409 do back recarrega a tela e explica, sem fechar o drawer", async () => {
    vi.mocked(updateProductionExecution).mockRejectedValue(
      new ApiError(409, "O apontamento foi alterado por outro usuário.", {}),
    );

    const { onSaved } = renderForm("edit", BOX, { ...EXECUTION, status: "REJECTED" });
    fireEvent.change(await screen.findByLabelText("Quantidade colhida (caixas)"), {
      target: { value: "13" },
    });
    submit();

    expect(
      await screen.findByText(/foi alterado por outra pessoa enquanto você editava/),
    ).toBeTruthy();
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it("outros erros mostram a mensagem do back e não recarregam", async () => {
    vi.mocked(updateProductionExecution).mockRejectedValue(
      new ApiError(400, "A quantidade produzida deve ser maior que zero.", {}),
    );

    const { onSaved } = renderForm("edit", BOX, { ...EXECUTION, status: "PENDING" });
    fireEvent.change(await screen.findByLabelText("Quantidade colhida (caixas)"), {
      target: { value: "13" },
    });
    submit();

    expect(
      await screen.findByText("A quantidade produzida deve ser maior que zero."),
    ).toBeTruthy();
    expect(onSaved).not.toHaveBeenCalled();
  });
});

describe("ExecutionFormDrawer — aviso de reenvio (UNIT-005)", () => {
  const WARNING = "Alterar quantidade ou data reenvia o apontamento para validação.";

  it("editar rejeitado mostra o aviso e o motivo", () => {
    renderForm("edit", BOX, {
      ...EXECUTION,
      status: "REJECTED",
      rejectionReason: "Data errada",
    });
    expect(screen.getByText(WARNING)).toBeTruthy();
    expect(screen.getByText("Motivo da rejeição: Data errada")).toBeTruthy();
  });

  it("pendente e criação não mostram o aviso", () => {
    renderForm("edit", BOX, { ...EXECUTION, status: "PENDING" });
    expect(screen.queryByText(WARNING)).toBeNull();
    cleanup();
    renderForm("create", BOX);
    expect(screen.queryByText(WARNING)).toBeNull();
  });
});
