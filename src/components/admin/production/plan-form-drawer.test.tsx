import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PlanFormDrawer } from "@/components/admin/production/plan-form-drawer";
import { listCrops, type Crop } from "@/lib/crops";
import { listHarvests } from "@/lib/harvests";
import {
  createProductionPlan,
  updateProductionPlan,
  type ProductionPlan,
} from "@/lib/production";

vi.mock("@/lib/crops", async () => {
  const actual = await vi.importActual<typeof import("@/lib/crops")>("@/lib/crops");
  return { ...actual, listCrops: vi.fn() };
});
vi.mock("@/lib/harvests", () => ({ listHarvests: vi.fn() }));
vi.mock("@/lib/production", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/production")>("@/lib/production");
  return { ...actual, createProductionPlan: vi.fn(), updateProductionPlan: vi.fn() };
});

const TOMATO: Crop = {
  id: "crop-1",
  name: "Tomate",
  variety: "Italiano",
  isPriority: false,
  cycleDays: 90,
  expectedProductivity: 1500,
  harvestType: "CONTINUOUS",
  unit: "BOX",
  unitWeightKg: 20,
};
const LEGACY: Crop = {
  ...TOMATO,
  id: "crop-2",
  name: "Alface",
  variety: "Crespa",
  expectedProductivity: null,
  harvestType: null,
  unit: null,
  unitWeightKg: null,
};

const PLAN: ProductionPlan = {
  id: "plan-1",
  crop: TOMATO,
  harvest: { id: "h-1", label: "Safra 2026", startDate: null, endDate: null },
  plantedArea: 2,
  status: "PLANNED",
  expectedHarvestStart: "2026-05-01",
  expectedHarvestEnd: "2026-06-30",
  expectedProductivity: 1500,
  expectedYield: 3000,
  plannedPlantingDate: "2026-02-01",
  createdAt: null,
};

function renderForm(mode: "create" | "edit", plan?: ProductionPlan) {
  const onSaved = vi.fn();
  render(
    <PlanFormDrawer
      mode={mode}
      producerId="farmer-1"
      open
      onOpenChange={vi.fn()}
      onSaved={onSaved}
      plan={plan}
    />,
  );
  return { onSaved };
}

async function pick(label: string, option: string) {
  const user = userEvent.setup();
  await user.click(screen.getByLabelText(label));
  await user.click(await screen.findByRole("option", { name: option }));
  await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
}

function submit() {
  fireEvent.submit(document.querySelector("form") as HTMLFormElement);
}

beforeEach(() => {
  vi.mocked(listCrops).mockResolvedValue([TOMATO, LEGACY]);
  vi.mocked(listHarvests).mockResolvedValue([
    { id: "h-1", label: "Safra 2026", startDate: "2026-01-01", endDate: "2026-12-31" },
  ]);
  vi.mocked(createProductionPlan).mockReset();
  vi.mocked(updateProductionPlan).mockReset();
});

afterEach(() => cleanup());

describe("PlanFormDrawer — meta calculada (UNIT-008 / AC-009)", () => {
  it("não tem campo de rendimento e calcula a meta em kg ao mudar cultura e área", async () => {
    renderForm("create");
    await screen.findByLabelText("Área plantada (ha)");
    expect(screen.queryByLabelText(/Previsão de colheita/)).toBeNull();
    expect(screen.queryByLabelText(/rendimento/i)).toBeNull();

    const target = screen.getByLabelText("Meta prevista") as HTMLInputElement;
    expect(target.readOnly).toBe(true);
    expect(target.value).toBe("—");

    await pick("Cultivo", "Tomate — Italiano");
    fireEvent.change(screen.getByLabelText("Área plantada (ha)"), {
      target: { value: "2,5" },
    });
    expect(target.value).toBe("3.750 kg");

    fireEvent.change(screen.getByLabelText("Área plantada (ha)"), {
      target: { value: "4" },
    });
    expect(target.value).toBe("6.000 kg");
  });

  it("criação envia o payload do RegisterDTO sem expectedYield nem status", async () => {
    vi.mocked(createProductionPlan).mockResolvedValue(PLAN);
    const { onSaved } = renderForm("create");
    await screen.findByLabelText("Área plantada (ha)");
    expect(screen.queryByLabelText("Status")).toBeNull();
    await pick("Safra", "Safra 2026");
    await pick("Cultivo", "Tomate — Italiano");
    fireEvent.change(screen.getByLabelText("Área plantada (ha)"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Início previsto da colheita"), {
      target: { value: "2026-05-01" },
    });
    submit();
    await waitFor(() =>
      expect(createProductionPlan).toHaveBeenCalledWith("farmer-1", {
        harvestId: "h-1",
        cropId: "crop-1",
        plantedArea: 2,
        expectedHarvestStart: "2026-05-01",
        expectedHarvestEnd: null,
        plannedPlantingDate: null,
      }),
    );
    expect(onSaved).toHaveBeenCalled();
  });
});

describe("PlanFormDrawer — cultura sem produtividade (UNIT-009 / AC-010)", () => {
  it("mostra aviso e desabilita o Salvar", async () => {
    renderForm("create");
    await screen.findByLabelText("Área plantada (ha)");
    await pick("Cultivo", "Alface — Crespa");
    expect(
      await screen.findByText(/não tem produtividade esperada/),
    ).toBeTruthy();
    expect((screen.getByRole("button", { name: "Salvar" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    submit();
    expect(createProductionPlan).not.toHaveBeenCalled();
  });
});

describe("PlanFormDrawer — janela e status (UNIT-010 / AC-011)", () => {
  it("fim anterior ao início mostra erro e não envia", async () => {
    renderForm("edit", PLAN);
    fireEvent.change(await screen.findByLabelText("Fim previsto da colheita"), {
      target: { value: "2026-04-01" },
    });
    submit();
    expect(
      await screen.findByText("A data final não pode ser anterior à data inicial"),
    ).toBeTruthy();
    expect(updateProductionPlan).not.toHaveBeenCalled();
  });

  it("edição: esvaziar uma data já definida mostra erro e não envia (o PUT trata null como manter)", async () => {
    renderForm("edit", PLAN);
    fireEvent.change(await screen.findByLabelText("Início previsto da colheita"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("Data prevista de plantio"), {
      target: { value: "" },
    });
    submit();
    expect(
      await screen.findAllByText(
        "Não é possível remover esta data depois de definida; altere para outra data",
      ),
    ).toHaveLength(2);
    expect(updateProductionPlan).not.toHaveBeenCalled();
  });

  it("janela é opcional: sem datas a criação não acusa erro", async () => {
    vi.mocked(createProductionPlan).mockResolvedValue(PLAN);
    renderForm("create");
    await screen.findByLabelText("Área plantada (ha)");
    await pick("Safra", "Safra 2026");
    await pick("Cultivo", "Tomate — Italiano");
    fireEvent.change(screen.getByLabelText("Área plantada (ha)"), { target: { value: "1" } });
    submit();
    await waitFor(() => expect(createProductionPlan).toHaveBeenCalled());
  });

  it("status é editável só na edição e vai no PUT com a produtividade do plano", async () => {
    vi.mocked(updateProductionPlan).mockResolvedValue(PLAN);
    renderForm("edit", PLAN);
    await screen.findByLabelText("Status");
    expect((screen.getByLabelText("Meta prevista") as HTMLInputElement).value).toBe("3.000 kg");
    await pick("Status", "Ativo");
    submit();
    await waitFor(() =>
      expect(updateProductionPlan).toHaveBeenCalledWith("plan-1", {
        plantedArea: 2,
        status: "ACTIVE",
        expectedHarvestStart: "2026-05-01",
        expectedHarvestEnd: "2026-06-30",
        expectedProductivity: 1500,
        plannedPlantingDate: "2026-02-01",
      }),
    );
  });
});

describe("PlanFormDrawer — QA (UNIT-003 / UNIT-004)", () => {
  it("recusa notação científica na área", async () => {
    renderForm("create");
    await screen.findByLabelText("Área plantada (ha)");
    await pick("Safra", "Safra 2026");
    await pick("Cultivo", "Tomate — Italiano");
    fireEvent.change(screen.getByLabelText("Área plantada (ha)"), { target: { value: "1e3" } });
    submit();
    expect(await screen.findByText(/Informe uma área válida/)).toBeTruthy();
    expect(createProductionPlan).not.toHaveBeenCalled();
  });

  it("recusa área abaixo de 0,01 e ponto decimal ambíguo", async () => {
    renderForm("create");
    await screen.findByLabelText("Área plantada (ha)");
    await pick("Safra", "Safra 2026");
    await pick("Cultivo", "Tomate — Italiano");
    for (const bad of ["0,001", "12.5"]) {
      fireEvent.change(screen.getByLabelText("Área plantada (ha)"), { target: { value: bad } });
      submit();
      expect(await screen.findByText(/Informe uma área válida/)).toBeTruthy();
    }
    expect(createProductionPlan).not.toHaveBeenCalled();
  });

  it("'1.234' vale 1234 e '12,5' vale 12,5 no envio; edição mostra vírgula", async () => {
    vi.mocked(createProductionPlan).mockResolvedValue(PLAN);
    renderForm("create");
    await screen.findByLabelText("Área plantada (ha)");
    await pick("Safra", "Safra 2026");
    await pick("Cultivo", "Tomate — Italiano");
    fireEvent.change(screen.getByLabelText("Área plantada (ha)"), { target: { value: "1.234" } });
    submit();
    await waitFor(() => expect(createProductionPlan).toHaveBeenCalled());
    expect(vi.mocked(createProductionPlan).mock.calls[0][1].plantedArea).toBe(1234);
    cleanup();

    renderForm("edit", { ...PLAN, plantedArea: 12.5 });
    expect(
      ((await screen.findByLabelText("Área plantada (ha)")) as HTMLInputElement).value,
    ).toBe("12,5");
  });

  it("plano legado com plantio fora da safra salva outras mudanças; mudar a data fora é recusado", async () => {
    vi.mocked(updateProductionPlan).mockResolvedValue(PLAN);
    const legacy: ProductionPlan = {
      ...PLAN,
      harvest: { id: "h-1", label: "Safra 2026", startDate: "2026-03-01", endDate: "2026-12-31" },
      plannedPlantingDate: "2026-02-01",
    };
    renderForm("edit", legacy);
    await screen.findByLabelText("Status");
    await pick("Status", "Ativo");
    submit();
    await waitFor(() => expect(updateProductionPlan).toHaveBeenCalled());
    cleanup();

    vi.mocked(updateProductionPlan).mockClear();
    renderForm("edit", legacy);
    fireEvent.change(await screen.findByLabelText("Data prevista de plantio"), {
      target: { value: "2026-01-15" },
    });
    submit();
    expect(await screen.findByText(/O plantio deve estar dentro da safra/)).toBeTruthy();
    expect(updateProductionPlan).not.toHaveBeenCalled();
  });

  it("recusa plantio fora do intervalo da safra escolhida", async () => {
    renderForm("create");
    await screen.findByLabelText("Área plantada (ha)");
    await pick("Safra", "Safra 2026");
    await pick("Cultivo", "Tomate — Italiano");
    fireEvent.change(screen.getByLabelText("Área plantada (ha)"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Data prevista de plantio"), {
      target: { value: "2025-12-31" },
    });
    submit();
    expect(
      await screen.findByText(/O plantio deve estar dentro da safra \(01\/01\/2026 a 31\/12\/2026\)/),
    ).toBeTruthy();
    expect(createProductionPlan).not.toHaveBeenCalled();
  });

  it("aceita plantio dentro da safra", async () => {
    vi.mocked(createProductionPlan).mockResolvedValue(PLAN);
    renderForm("create");
    await screen.findByLabelText("Área plantada (ha)");
    await pick("Safra", "Safra 2026");
    await pick("Cultivo", "Tomate — Italiano");
    fireEvent.change(screen.getByLabelText("Área plantada (ha)"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Data prevista de plantio"), {
      target: { value: "2026-03-01" },
    });
    submit();
    await waitFor(() => expect(createProductionPlan).toHaveBeenCalled());
  });

  it("recusa fim previsto anterior ao plantio", async () => {
    renderForm("edit", PLAN);
    fireEvent.change(await screen.findByLabelText("Início previsto da colheita"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("Início previsto da colheita"), {
      target: { value: "2026-01-10" },
    });
    fireEvent.change(screen.getByLabelText("Fim previsto da colheita"), {
      target: { value: "2026-01-20" },
    });
    submit();
    expect(await screen.findByText("A data final não pode ser anterior ao plantio")).toBeTruthy();
    expect(updateProductionPlan).not.toHaveBeenCalled();
  });
});
