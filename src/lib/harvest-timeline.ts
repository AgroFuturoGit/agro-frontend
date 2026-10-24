import type { ProductionPlan } from "@/lib/production";

export type TimelineGranularity = "WEEK" | "MONTH";

export type TimelinePoint = {
  /** Início do período, "YYYY-MM-DD". */
  date: string;
  /** kg previstos no período; null quando o plano não tem janela. */
  expectedValue: number | null;
  /** kg VALIDATED no período. */
  actualValue: number;
  /** kg PENDING no período. */
  pendingValue: number;
};

export type HarvestTimeline = {
  harvestType: "SINGLE" | "CONTINUOUS";
  granularity: TimelineGranularity;
  unit: "kg";
  hasExpectedWindow: boolean;
  points: TimelinePoint[];
};

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/;

function dayKey(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = DATE_RE.exec(value);
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/**
 * Janela de colheita válida (início ≤ fim) e meta > 0: só então a curva
 * prevista é desenhada (BR-007). Os pontos em si vêm do back.
 */
export function hasValidExpectedWindow(
  plan: Pick<
    ProductionPlan,
    "expectedHarvestStart" | "expectedHarvestEnd" | "expectedYield"
  >,
): boolean {
  const start = dayKey(plan.expectedHarvestStart);
  const end = dayKey(plan.expectedHarvestEnd);
  return start !== null && end !== null && end >= start && plan.expectedYield > 0;
}
