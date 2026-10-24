import { afterEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "@/lib/api";
import {
  getFarmerSummary,
  getHarvestTimeline,
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
