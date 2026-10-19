import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api";
import {
  createProductionExecution,
  createProductionPlan,
  getProductionDashboard,
  getProductionPlan,
  listProductionExecutions,
  rejectProductionExecution,
  validateProductionExecution,
  updateProductionExecution,
  updateProductionPlan,
} from "@/lib/production";

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
}));

const apiRequestMock = vi.mocked(apiRequest);

const RAW_CROP = {
  id: "crop-1",
  name: "Tomate",
  variety: "Italiano",
  isPriority: false,
  cycleDays: 90,
  expectedProductivity: "1500.00",
  harvestType: "CONTINUOUS",
  unit: "BOX",
  unitWeightKg: "20",
};

const RAW_PLAN = {
  id: "plan-1",
  farmer: { id: "f-1" },
  harvest: { id: "h-1", label: "Safra 2026", startDate: "2026-01-01", endDate: "2026-12-31" },
  crop: RAW_CROP,
  plantedArea: "2.5",
  status: "ACTIVE",
  expectedHarvestStart: "2026-05-01",
  expectedHarvestEnd: "2026-06-30",
  expectedProductivity: "1500.00",
  plannedPlantingDate: "2026-02-01",
  createdAt: "2026-01-10T10:00:00",
};

beforeEach(() => {
  apiRequestMock.mockReset();
});

describe("mapPlan (UNIT-004)", () => {
  it("lê status, janela, produtividade, crop completo e deriva expectedYield", async () => {
    apiRequestMock.mockResolvedValue(RAW_PLAN);
    const plan = await getProductionPlan("plan-1");
    expect(plan.status).toBe("ACTIVE");
    expect(plan.expectedHarvestStart).toBe("2026-05-01");
    expect(plan.expectedHarvestEnd).toBe("2026-06-30");
    expect(plan.expectedProductivity).toBe(1500);
    expect(plan.plantedArea).toBe(2.5);
    expect(plan.expectedYield).toBe(3750);
    expect(plan.crop).toMatchObject({
      id: "crop-1",
      unit: "BOX",
      unitWeightKg: 20,
      harvestType: "CONTINUOUS",
      cycleDays: 90,
    });
  });

  it("produtividade nula => meta 0; status desconhecido => null", async () => {
    apiRequestMock.mockResolvedValue({
      ...RAW_PLAN,
      status: "WHATEVER",
      expectedProductivity: null,
      expectedHarvestStart: null,
      expectedHarvestEnd: null,
    });
    const plan = await getProductionPlan("plan-1");
    expect(plan.status).toBeNull();
    expect(plan.expectedProductivity).toBeNull();
    expect(plan.expectedYield).toBe(0);
    expect(plan.expectedHarvestStart).toBeNull();
  });
});

describe("mapExecution (UNIT-005)", () => {
  it("lê quantity, quantityKg, harvestedAt, status e notes", async () => {
    apiRequestMock.mockResolvedValue([
      {
        id: "e-1",
        productionPlanId: "plan-1",
        quantity: "12",
        quantityKg: "240.00",
        harvestedAt: "2026-05-10",
        status: "PENDING",
        validatedBy: null,
        validatedAt: null,
        notes: "Lote A",
        createdAt: "2026-05-10T08:00:00",
      },
      {
        id: "e-2",
        productionPlanId: "plan-1",
        quantity: 1,
        quantityKg: 1,
        harvestedAt: "2026-05-11",
        status: "BOGUS",
      },
    ]);
    const list = await listProductionExecutions("plan-1");
    expect(list[0]).toMatchObject({
      id: "e-1",
      quantity: 12,
      quantityKg: 240,
      harvestedAt: "2026-05-10",
      status: "PENDING",
      notes: "Lote A",
    });
    expect(list[1].status).toBeNull();
    expect(list[1].notes).toBeNull();
    expect(Object.keys(list[0]).sort()).toEqual(
      [
        "createdAt",
        "harvestedAt",
        "id",
        "notes",
        "productionPlanId",
        "quantity",
        "quantityKg",
        "rejectionReason",
        "status",
        "updatedAt",
        "validatedAt",
        "validatedBy",
      ].sort(),
    );
  });
});

describe("payloads (UNIT-006)", () => {
  it("criação de plano não envia expectedYield e segue o RegisterDTO", async () => {
    apiRequestMock.mockResolvedValue(RAW_PLAN);
    await createProductionPlan("farmer-1", {
      harvestId: "h-1",
      cropId: "crop-1",
      plantedArea: 2.5,
      expectedHarvestStart: "2026-05-01",
      expectedHarvestEnd: null,
      plannedPlantingDate: null,
    });
    const [path, options] = apiRequestMock.mock.calls[0];
    expect(path).toBe("/farmers/farmer-1/production-plans");
    expect(options).toMatchObject({ method: "POST" });
    const body = (options as { body: Record<string, unknown> }).body;
    expect(body).not.toHaveProperty("expectedYield");
    expect(Object.keys(body).sort()).toEqual(
      [
        "cropId",
        "expectedHarvestEnd",
        "expectedHarvestStart",
        "harvestId",
        "plannedPlantingDate",
        "plantedArea",
      ].sort(),
    );
  });

  it("edição de plano envia plantedArea, status, janela, produtividade e plantio", async () => {
    apiRequestMock.mockResolvedValue(RAW_PLAN);
    await updateProductionPlan("plan-1", {
      plantedArea: 3,
      status: "FINISHED",
      expectedHarvestStart: "2026-05-01",
      expectedHarvestEnd: "2026-06-30",
      expectedProductivity: 1500,
      plannedPlantingDate: "2026-02-01",
    });
    const [path, options] = apiRequestMock.mock.calls[0];
    expect(path).toBe("/production-plans/plan-1");
    const body = (options as { body: Record<string, unknown> }).body;
    expect(options).toMatchObject({ method: "PUT" });
    expect(body).not.toHaveProperty("expectedYield");
    expect(body.status).toBe("FINISHED");
    expect(body.expectedProductivity).toBe(1500);
  });

  it("apontamento: payload leva quantity, quantityKg, harvestedAt e notes", async () => {
    apiRequestMock.mockResolvedValue({
      id: "e-1",
      productionPlanId: "plan-1",
      quantity: 12,
      quantityKg: 240,
      harvestedAt: "2026-05-10",
      status: "PENDING",
    });
    await createProductionExecution("plan-1", {
      quantity: 12,
      quantityKg: 240,
      harvestedAt: "2026-05-10",
      notes: null,
    });
    await updateProductionExecution("e-1", {
      quantity: 12,
      quantityKg: 240,
      harvestedAt: "2026-05-10",
      notes: "x",
    });
    expect(apiRequestMock.mock.calls[0]).toEqual([
      "/production-plans/plan-1/executions",
      {
        method: "POST",
        body: { quantity: 12, quantityKg: 240, harvestedAt: "2026-05-10", notes: null },
      },
    ]);
    expect(apiRequestMock.mock.calls[1][0]).toBe("/production-executions/e-1");
  });
});

const RAW_EXECUTION = {
  id: "exec-1",
  productionPlanId: "plan-1",
  quantity: "12",
  quantityKg: "240.00",
  harvestedAt: "2026-05-10",
  status: "REJECTED",
  notes: null,
  rejectionReason: "Quantidade acima do esperado",
  validatedBy: "user-9",
  validatedAt: "2026-05-11T09:30:00",
  createdAt: "2026-05-10T08:00:00",
  updatedAt: "2026-05-11T09:30:00",
};

describe("mapExecution — decisão (UNIT-001)", () => {
  it("lê rejectionReason, validatedBy, validatedAt e updatedAt", async () => {
    apiRequestMock.mockResolvedValue([RAW_EXECUTION]);
    const [execution] = await listProductionExecutions("plan-1");
    expect(execution).toMatchObject({
      status: "REJECTED",
      quantityKg: 240,
      rejectionReason: "Quantidade acima do esperado",
      validatedBy: "user-9",
      validatedAt: "2026-05-11T09:30:00",
      updatedAt: "2026-05-11T09:30:00",
    });
  });

  it("campos ausentes viram null", async () => {
    apiRequestMock.mockResolvedValue([
      { id: "e", productionPlanId: "p", quantity: 1, quantityKg: 1, harvestedAt: "2026-05-10" },
    ]);
    const [execution] = await listProductionExecutions("plan-1");
    expect(execution.rejectionReason).toBeNull();
    expect(execution.validatedBy).toBeNull();
    expect(execution.validatedAt).toBeNull();
    expect(execution.updatedAt).toBeNull();
  });
});

describe("validar e rejeitar apontamento (UNIT-001)", () => {
  it("validate faz POST sem corpo", async () => {
    apiRequestMock.mockResolvedValue({ ...RAW_EXECUTION, status: "VALIDATED", rejectionReason: null });
    const result = await validateProductionExecution("exec-1");
    expect(apiRequestMock).toHaveBeenCalledWith(
      "/production-executions/exec-1/validate",
      { method: "POST" },
    );
    expect(result.status).toBe("VALIDATED");
  });

  it("reject com motivo envia reason aparado", async () => {
    apiRequestMock.mockResolvedValue(RAW_EXECUTION);
    await rejectProductionExecution("exec-1", "  Data errada  ");
    expect(apiRequestMock).toHaveBeenCalledWith(
      "/production-executions/exec-1/reject",
      { method: "POST", body: { reason: "Data errada" } },
    );
  });

  it.each([undefined, null, "", "   "])("reject sem motivo (%j) não envia reason", async (reason) => {
    apiRequestMock.mockResolvedValue(RAW_EXECUTION);
    await rejectProductionExecution("exec-1", reason);
    const [, options] = apiRequestMock.mock.calls[0];
    expect((options as { body: object }).body).not.toHaveProperty("reason");
  });
});

describe("getProductionDashboard (UNIT-001)", () => {
  it("mapeia totais e comunidades, com 'Sem comunidade' e números em string", async () => {
    apiRequestMock.mockResolvedValue({
      farmerCount: 3,
      planCount: 4,
      expectedYield: "40000.00",
      actualYield: "18000",
      difference: "-22000",
      percentageRealized: "45",
      communities: [
        { communityId: "c-1", communityName: "Alto da Serra", farmerCount: 2, planCount: 3, expectedYield: 30000, actualYield: 18000, difference: -12000, percentageRealized: 60 },
        { communityId: null, communityName: null, farmerCount: 1, planCount: 1, expectedYield: 10000, actualYield: 0, difference: -10000, percentageRealized: 0 },
      ],
    });
    const dashboard = await getProductionDashboard();
    expect(apiRequestMock).toHaveBeenCalledWith("/production/dashboard", { method: "GET" });
    expect(dashboard).toMatchObject({
      farmerCount: 3,
      planCount: 4,
      expectedYield: 40000,
      actualYield: 18000,
      difference: -22000,
      percentageRealized: 45,
    });
    expect(dashboard.communities).toHaveLength(2);
    expect(dashboard.communities[0].communityName).toBe("Alto da Serra");
    expect(dashboard.communities[1]).toMatchObject({ communityId: null, communityName: "Sem comunidade" });
  });

  it("sem communities devolve lista vazia", async () => {
    apiRequestMock.mockResolvedValue({ farmerCount: 0, planCount: 0 });
    const dashboard = await getProductionDashboard();
    expect(dashboard.communities).toEqual([]);
    expect(dashboard.expectedYield).toBe(0);
  });
});
