import { afterEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "@/lib/api";
import {
  getFarmerSummary,
  getHarvestTimeline,
  getGlobalSummary,
  getManagerSummary,
  getOrganizationSummary,
  mapManagementSummary,
  getTechnicianSummary,
  mapTechnicianSummary,
  mapFarmerSummary,
  mapTimeline,
} from "@/lib/analytics";

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }));

afterEach(() => vi.clearAllMocks());

describe("analytics — chamadas (UNIT-001)", () => {
  it("getFarmerSummary sem harvestId não envia query", async () => {
    vi.mocked(apiRequest).mockResolvedValue({});
    await getFarmerSummary();
    expect(apiRequest).toHaveBeenCalledWith("/analytics/farmers/me/summary", {
      method: "GET",
    });
  });

  it("getFarmerSummary com harvestId envia o parâmetro", async () => {
    vi.mocked(apiRequest).mockResolvedValue({});
    await getFarmerSummary("h-1");
    expect(vi.mocked(apiRequest).mock.calls[0][0]).toBe(
      "/analytics/farmers/me/summary?harvestId=h-1",
    );
  });

  it("getHarvestTimeline usa WEEK por padrão e aceita MONTH", async () => {
    vi.mocked(apiRequest).mockResolvedValue({});
    await getHarvestTimeline("p-1");
    await getHarvestTimeline("p-1", "MONTH");
    expect(vi.mocked(apiRequest).mock.calls[0][0]).toBe(
      "/analytics/plans/p-1/timeline?granularity=WEEK",
    );
    expect(vi.mocked(apiRequest).mock.calls[1][0]).toBe(
      "/analytics/plans/p-1/timeline?granularity=MONTH",
    );
  });
});

describe("analytics — mappers (UNIT-001)", () => {
  it("converte números como string/number e trata nulos", () => {
    const summary = mapFarmerSummary({
      farmerId: "f-1",
      currentHarvest: null,
      isEmpty: false,
      totalPlansCount: 2,
      activePlotsCount: "1",
      totalPlantedAreaHa: "12.50",
      totalTargetKg: 1000,
      totalRealizedKg: "250.00",
      totalPendingKg: null,
      overallCompletionPct: "25.00",
      plans: [
        {
          planId: "p-1",
          cropName: "Milho",
          cropVariety: null,
          status: "ACTIVE",
          plantedAreaHa: "2.00",
          targetKg: "1000.00",
          realizedKg: 112,
          pendingKg: undefined,
          completionPct: "112.00",
          progressStatus: "GOAL_REACHED",
          lastExecutionDate: null,
        },
      ],
    });
    expect(summary.totalPlantedAreaHa).toBe(12.5);
    expect(summary.totalRealizedKg).toBe(250);
    expect(summary.totalPendingKg).toBe(0);
    expect(summary.currentHarvest).toBeNull();
    expect(summary.plans[0]).toMatchObject({
      planId: "p-1",
      cropVariety: null,
      targetKg: 1000,
      completionPct: 112,
      pendingKg: 0,
      progressStatus: "GOAL_REACHED",
      lastExecutionDate: null,
    });
  });

  it("isEmpty acompanha a lista vazia e status desconhecido vira NOT_STARTED", () => {
    expect(mapFarmerSummary({ isEmpty: true, plans: [] }).isEmpty).toBe(true);
    expect(mapFarmerSummary({}).plans).toEqual([]);
    expect(
      mapFarmerSummary({ plans: [{ planId: "x", progressStatus: "???" }] }).plans[0]
        .progressStatus,
    ).toBe("NOT_STARTED");
  });

  it("mapTimeline converte pontos e preserva expectedValue nulo", () => {
    const t = mapTimeline({
      planId: "p-1",
      harvestType: "CONTINUOUS",
      granularity: "MONTH",
      points: [
        { date: "2026-05-01", expectedValue: "10.50", actualValue: "3", pendingValue: 1 },
        { date: "2026-06-01", expectedValue: null, actualValue: null, pendingValue: null },
      ],
    });
    expect(t.granularity).toBe("MONTH");
    expect(t.points[0]).toEqual({
      date: "2026-05-01",
      expectedValue: 10.5,
      actualValue: 3,
      pendingValue: 1,
    });
    expect(t.points[1].expectedValue).toBeNull();
    expect(t.points[1].actualValue).toBe(0);
  });

  it("CR-005: cartão sem planId é descartado em vez de virar 'undefined'", () => {
    const summary = mapFarmerSummary({
      isEmpty: false,
      plans: [{ cropName: "Sem id" }, { planId: "p-9", cropName: "Milho" }],
    });
    expect(summary.plans.map((p) => p.planId)).toEqual(["p-9"]);
  });
});

describe("analytics — resumo do técnico (UNIT-001)", () => {
  it("sem filtros não envia query", async () => {
    vi.mocked(apiRequest).mockResolvedValue({});
    await getTechnicianSummary();
    expect(apiRequest).toHaveBeenCalledWith("/analytics/technicians/me/summary", {
      method: "GET",
    });
  });

  it("envia só os parâmetros informados", async () => {
    vi.mocked(apiRequest).mockResolvedValue({});
    await getTechnicianSummary({ communityId: "c-1", cropId: "k-1" });
    expect(vi.mocked(apiRequest).mock.calls[0][0]).toBe(
      "/analytics/technicians/me/summary?communityId=c-1&cropId=k-1",
    );
    await getTechnicianSummary({ harvestId: "h 1" });
    expect(vi.mocked(apiRequest).mock.calls[1][0]).toBe(
      "/analytics/technicians/me/summary?harvestId=h+1",
    );
  });

  it("converte números string/number, nulos e tolera listas ausentes", () => {
    const s = mapTechnicianSummary({
      technicianName: "Téc",
      currentHarvest: { id: 7, label: "Safra 2026" },
      isEmpty: false,
      totalAssistedCommunitiesCount: 2,
      totalPlantedAreaHa: "12.50",
      totalTargetKg: 1000,
      totalRealizedKg: "400.00",
      totalPendingKg: null,
      overallCompletionPct: "40.00",
      totalWarningsCount: 1,
      warnings: [
        { cropName: "sem plano" },
        {
          planId: "p-1",
          farmerName: "Zé",
          warningTypes: ["LOW_YIELD_RISK", "???", "INACTIVE_EXECUTIONS"],
          severity: "HIGH",
          message: "m",
          completionPct: "10.5",
          daysWithoutExecution: null,
        },
      ],
      communities: [{ communityName: "sem id" }, { communityId: "c-1", targetKg: "5" }],
      farmers: [
        { farmerName: "sem id" },
        { farmerId: "f-1", isCompliant: true, warningsCount: "2" },
      ],
    });
    expect(s.currentHarvest?.id).toBe("7");
    expect(s.totalPlantedAreaHa).toBe(12.5);
    expect(s.totalRealizedKg).toBe(400);
    expect(s.totalPendingKg).toBe(0);
    expect(s.warnings).toHaveLength(1);
    expect(s.warnings[0].warningTypes).toEqual(["INACTIVE_EXECUTIONS", "LOW_YIELD_RISK"]);
    expect(s.warnings[0].severity).toBe("HIGH");
    expect(s.warnings[0].completionPct).toBe(10.5);
    expect(s.warnings[0].daysWithoutExecution).toBeNull();
    expect(s.communities.map((c) => c.communityId)).toEqual(["c-1"]);
    expect(s.communities[0].targetKg).toBe(5);
    expect(s.farmers).toHaveLength(1);
    expect(s.farmers[0].isCompliant).toBe(true);
    expect(s.farmers[0].warningsCount).toBe(2);
  });

  it("resposta vazia vira listas vazias e zeros", () => {
    const s = mapTechnicianSummary({});
    expect(s.warnings).toEqual([]);
    expect(s.communities).toEqual([]);
    expect(s.farmers).toEqual([]);
    expect(s.currentHarvest).toBeNull();
    expect(s.totalWarningsCount).toBe(0);
    expect(s.isEmpty).toBe(false);
  });

  it("mapManagementSummary descarta currentHarvest sem id", () => {
    const s = mapManagementSummary({ currentHarvest: { label: "2026" } });
    expect(s.currentHarvest).toBeNull();
  });
});

describe("analytics — resumo da gestão (UNIT-001)", () => {
  it("getManagerSummary usa organizations/me e só envia os filtros informados", async () => {
    vi.mocked(apiRequest).mockResolvedValue({});
    await getManagerSummary();
    await getManagerSummary({ harvestId: "h-1", communityId: "c-1", organizationId: "o-9" });
    expect(vi.mocked(apiRequest).mock.calls[0][0]).toBe("/analytics/organizations/me/summary");
    expect(vi.mocked(apiRequest).mock.calls[1][0]).toBe(
      "/analytics/organizations/me/summary?harvestId=h-1&communityId=c-1",
    );
  });

  it("getGlobalSummary envia harvest, organização e comunidade", async () => {
    vi.mocked(apiRequest).mockResolvedValue({});
    await getGlobalSummary();
    await getGlobalSummary({ harvestId: "h 1", organizationId: "o-1", communityId: "c-1" });
    expect(vi.mocked(apiRequest).mock.calls[0][0]).toBe("/analytics/global/summary");
    expect(vi.mocked(apiRequest).mock.calls[1][0]).toBe(
      "/analytics/global/summary?harvestId=h+1&organizationId=o-1&communityId=c-1",
    );
  });

  it("getOrganizationSummary usa o id na URL", async () => {
    vi.mocked(apiRequest).mockResolvedValue({});
    await getOrganizationSummary("o-1", { communityId: "c-2" });
    expect(vi.mocked(apiRequest).mock.calls[0][0]).toBe(
      "/analytics/organizations/o-1/summary?communityId=c-2",
    );
  });

  it("mapManagementSummary converte números, nulos e escopo", () => {
    const s = mapManagementSummary({
      scope: "GLOBAL",
      organizationId: null,
      organizationName: null,
      currentHarvest: { id: "h-1", label: "2026", startDate: "2026-01-01", endDate: "2026-12-31" },
      isEmpty: false,
      totalOrganizationsCount: 2,
      totalFarmersCount: "10",
      compliantFarmersCount: 4,
      complianceRatePct: "40.00",
      totalTargetKg: "1000.50",
      totalRealizedKg: null,
      overallConversionRatePct: "12.34",
      cropRanking: [
        { rankPosition: 1, cropId: "k", cropName: "Milho", plansCount: 2, targetKg: "500.00", realizedKg: "50.00", conversionRatePct: "10.00", productionSharePct: "60.00" },
      ],
      communities: [
        { communityId: "c-1", communityName: "Serra", organizationName: "Coop", activeFarmersCount: 3, lastExecutionDate: "2026-05-01" },
        { communityName: "sem id" },
      ],
      organizations: [{ organizationId: "o-1", organizationName: "Coop", communitiesCount: 1, conversionRatePct: "5.5" }],
    });
    expect(s.scope).toBe("GLOBAL");
    expect(s.totalFarmersCount).toBe(10);
    expect(s.totalTargetKg).toBe(1000.5);
    expect(s.totalRealizedKg).toBe(0);
    expect(s.overallConversionRatePct).toBe(12.34);
    expect(s.cropRanking[0]).toMatchObject({ cropName: "Milho", targetKg: 500, productionSharePct: 60, cropVariety: null });
    expect(s.communities).toHaveLength(1);
    expect(s.communities[0].lastExecutionDate).toBe("2026-05-01");
    expect(s.organizations[0].conversionRatePct).toBe(5.5);
  });

  it("tolera listas ausentes e assume escopo da organização", () => {
    const s = mapManagementSummary({});
    expect(s.scope).toBe("ORGANIZATION");
    expect(s.cropRanking).toEqual([]);
    expect(s.communities).toEqual([]);
    expect(s.organizations).toEqual([]);
    expect(s.currentHarvest).toBeNull();
    expect(s.isEmpty).toBe(false);
  });

  it("mapManagementSummary descarta currentHarvest sem id", () => {
    const s = mapManagementSummary({ currentHarvest: { label: "2026" } });
    expect(s.currentHarvest).toBeNull();
  });
});
