import { describe, expect, it } from "vitest";

import { buildHarvestTimeline } from "@/lib/harvest-timeline";
import type { Crop } from "@/lib/crops";
import type { ProductionExecution, ProductionPlan } from "@/lib/production";

function makePlan(overrides: Partial<ProductionPlan> = {}): ProductionPlan {
  return {
    id: "plan-1",
    crop: { harvestType: "CONTINUOUS", unit: "KG" } as Crop,
    harvest: null,
    plantedArea: 1,
    status: "ACTIVE",
    expectedHarvestStart: null,
    expectedHarvestEnd: null,
    expectedProductivity: null,
    expectedYield: 0,
    plannedPlantingDate: null,
    createdAt: null,
    ...overrides,
  };
}

let seq = 0;
function exec(
  harvestedAt: string | null,
  quantityKg: number,
  status: ProductionExecution["status"] = "VALIDATED",
): ProductionExecution {
  seq += 1;
  return {
    id: `e-${seq}`,
    productionPlanId: "plan-1",
    quantity: quantityKg,
    quantityKg,
    harvestedAt,
    status,
    notes: null,
    createdAt: null,
    rejectionReason: null,
    validatedBy: null,
    validatedAt: null,
    updatedAt: null,
  };
}

const sum = (xs: (number | null)[]) =>
  Math.round(xs.reduce<number>((a, b) => a + (b ?? 0), 0) * 100) / 100;

describe("buildHarvestTimeline", () => {
  it("UNIT-001: semana começa na segunda e mês no dia 1 (virada de ano)", () => {
    const plan = makePlan();
    const week = buildHarvestTimeline(
      plan,
      [exec("2027-12-31", 10), exec("2028-01-01", 5)],
      "WEEK",
    );
    expect(week.points).toHaveLength(1);
    expect(week.points[0]).toMatchObject({ date: "2027-12-27", actualValue: 15 });

    const month = buildHarvestTimeline(
      plan,
      [exec("2027-12-31", 10), exec("2028-01-01", 5)],
      "MONTH",
    );
    expect(month.points.map((p) => p.date)).toEqual(["2027-12-01", "2028-01-01"]);
    expect(month.points.map((p) => p.actualValue)).toEqual([10, 5]);
  });

  it("UNIT-002: ano bissexto agrupa 29/02/2028 e distribui fevereiro com 29 dias", () => {
    const week = buildHarvestTimeline(makePlan(), [exec("2028-02-29", 7)], "WEEK");
    expect(week.points[0].date).toBe("2028-02-28");
    const month = buildHarvestTimeline(makePlan(), [exec("2028-02-29", 7)], "MONTH");
    expect(month.points[0].date).toBe("2028-02-01");

    // Janela = fevereiro inteiro (29 dias) + 1º de março: 30 dias, 290 kg.
    const plan = makePlan({
      expectedHarvestStart: "2028-02-01",
      expectedHarvestEnd: "2028-03-01",
      expectedYield: 300,
    });
    const t = buildHarvestTimeline(plan, [], "MONTH");
    expect(t.points.map((p) => p.date)).toEqual(["2028-02-01", "2028-03-01"]);
    expect(t.points[0].expectedValue).toBe(290);
    expect(t.points[1].expectedValue).toBe(10);
  });

  it("UNIT-003: períodos vazios aparecem e apontamentos do mesmo período somam", () => {
    const t = buildHarvestTimeline(
      makePlan(),
      [exec("2026-05-04", 10), exec("2026-05-06", 5), exec("2026-05-25", 3)],
      "WEEK",
    );
    expect(t.points.map((p) => p.date)).toEqual([
      "2026-05-04",
      "2026-05-11",
      "2026-05-18",
      "2026-05-25",
    ]);
    expect(t.points.map((p) => p.actualValue)).toEqual([15, 0, 0, 3]);
    expect(t.points.map((p) => p.pendingValue)).toEqual([0, 0, 0, 0]);
    expect(sum(t.points.map((p) => p.actualValue))).toBe(18);
  });

  it("UNIT-004: validado x pendente; rejeitado, status nulo e sem data ficam fora", () => {
    const t = buildHarvestTimeline(
      makePlan(),
      [
        exec("2026-05-04", 10, "VALIDATED"),
        exec("2026-05-05", 4, "PENDING"),
        exec("2026-05-05", 99, "REJECTED"),
        exec("2026-05-05", 98, null),
        exec(null, 97, "VALIDATED"),
      ],
      "WEEK",
    );
    expect(t.points).toHaveLength(1);
    expect(t.points[0]).toMatchObject({ actualValue: 10, pendingValue: 4 });
  });

  it("UNIT-005: soma dos previstos é exatamente expectedYield, proporcional a dias", () => {
    // 04/05/2026 (segunda) a 29/06/2026: 57 dias, 1800 kg.
    const plan = makePlan({
      expectedHarvestStart: "2026-05-04",
      expectedHarvestEnd: "2026-06-29",
      expectedYield: 1800,
    });
    const week = buildHarvestTimeline(plan, [], "WEEK");
    expect(sum(week.points.map((p) => p.expectedValue))).toBe(1800);
    expect(week.points[0].expectedValue).toBe(
      Math.round(((1800 * 7) / 57) * 100) / 100,
    );
    // Última semana (29/06) tem 1 dia dentro da janela.
    expect(week.points[week.points.length - 1].date).toBe("2026-06-29");

    const month = buildHarvestTimeline(plan, [], "MONTH");
    expect(month.points.map((p) => p.date)).toEqual([
      "2026-05-01",
      "2026-06-01",
    ]);
    expect(sum(month.points.map((p) => p.expectedValue))).toBe(1800);

    // Resíduo de arredondamento (100 kg em 3 dias) vai ao último período.
    const odd = makePlan({
      expectedHarvestStart: "2026-05-04",
      expectedHarvestEnd: "2026-05-18",
      expectedYield: 100,
    });
    const o = buildHarvestTimeline(odd, [], "WEEK");
    expect(sum(o.points.map((p) => p.expectedValue))).toBe(100);
  });

  it("UNIT-005b: apontamento fora da janela estende o eixo com previsto 0", () => {
    const plan = makePlan({
      expectedHarvestStart: "2026-05-11",
      expectedHarvestEnd: "2026-05-17",
      expectedYield: 70,
    });
    const t = buildHarvestTimeline(plan, [exec("2026-05-04", 1), exec("2026-05-26", 2)], "WEEK");
    expect(t.points.map((p) => p.date)).toEqual([
      "2026-05-04",
      "2026-05-11",
      "2026-05-18",
      "2026-05-25",
    ]);
    expect(t.points.map((p) => p.expectedValue)).toEqual([0, 70, 0, 0]);
  });

  it("UNIT-006: sem janela, hasExpectedWindow false e previsto nulo", () => {
    const t = buildHarvestTimeline(
      makePlan({ expectedHarvestStart: "2026-05-04", expectedHarvestEnd: null, expectedYield: 500 }),
      [exec("2026-05-04", 1)],
      "WEEK",
    );
    expect(t.hasExpectedWindow).toBe(false);
    expect(t.points.every((p) => p.expectedValue === null)).toBe(true);

    const zero = buildHarvestTimeline(
      makePlan({ expectedHarvestStart: "2026-05-04", expectedHarvestEnd: "2026-05-20", expectedYield: 0 }),
      [exec("2026-05-04", 1)],
    );
    expect(zero.hasExpectedWindow).toBe(false);
    expect(zero.points.every((p) => p.expectedValue === null)).toBe(true);
  });

  it("UNIT-007: granularidade automática WEEK até 16 semanas, MONTH acima", () => {
    const at16 = makePlan({
      expectedHarvestStart: "2026-05-04",
      expectedHarvestEnd: "2026-08-23", // 16 semanas (04/05 a 23/08)
      expectedYield: 100,
    });
    const a = buildHarvestTimeline(at16, []);
    expect(a.granularity).toBe("WEEK");
    expect(a.points).toHaveLength(16);

    const over = makePlan({
      expectedHarvestStart: "2026-05-04",
      expectedHarvestEnd: "2026-08-24", // 17 semanas
      expectedYield: 100,
    });
    expect(buildHarvestTimeline(over, []).granularity).toBe("MONTH");
    expect(buildHarvestTimeline(over, [], "WEEK").granularity).toBe("WEEK");
    expect(buildHarvestTimeline(at16, [], "MONTH").granularity).toBe("MONTH");
  });

  it("UNIT-008: resultado independe do fuso do processo", () => {
    const plan = makePlan({
      expectedHarvestStart: "2026-03-29", // domingo; dia da virada de horário em alguns fusos
      expectedHarvestEnd: "2026-04-05",
      expectedYield: 80,
    });
    const t = buildHarvestTimeline(plan, [exec("2026-03-30", 5)], "WEEK");
    expect(t.points.map((p) => p.date)).toEqual(["2026-03-23", "2026-03-30"]);
    expect(t.points.map((p) => p.expectedValue)).toEqual([10, 70]);
    expect(t.points.map((p) => p.actualValue)).toEqual([0, 5]);
  });

  it("harvestType nulo é tratado como SINGLE; vazio sem janela não tem pontos", () => {
    const t = buildHarvestTimeline(makePlan({ crop: null }), []);
    expect(t.harvestType).toBe("SINGLE");
    expect(t.points).toEqual([]);
    expect(t.unit).toBe("kg");
  });

  it("CR-002: apontamento com ano absurdo não explode o eixo (fora de 5 anos da janela)", () => {
    const plan = makePlan({
      expectedHarvestStart: "2026-05-01",
      expectedHarvestEnd: "2026-06-30",
      expectedYield: 600,
    });
    const t = buildHarvestTimeline(
      plan,
      [exec("2026-05-10", 50), exec("2206-05-05", 999), exec("0001-01-01", 999)],
      "WEEK",
    );
    expect(t.points.length).toBeLessThanOrEqual(10);
    expect(sum(t.points.map((p) => p.actualValue))).toBe(50);
    expect(sum(t.points.map((p) => p.expectedValue))).toBe(600);
  });

  it("CR-002: sem janela, a referência é a mediana das datas", () => {
    const t = buildHarvestTimeline(
      makePlan(),
      [exec("2026-05-04", 10), exec("2026-05-20", 20), exec("2026-06-01", 30), exec("2206-05-05", 999)],
      "MONTH",
    );
    expect(t.points.map((p) => p.date)).toEqual(["2026-05-01", "2026-06-01"]);
    expect(sum(t.points.map((p) => p.actualValue))).toBe(60);
  });
});
