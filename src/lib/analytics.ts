import { apiRequest } from "@/lib/api";
import type { PlanStatus } from "@/lib/production";
import type { TimelineGranularity, TimelinePoint } from "@/lib/harvest-timeline";

export type ProgressStatus =
  | "GOAL_REACHED"
  | "ON_TRACK"
  | "BELOW_EXPECTED"
  | "DELAYED"
  | "NOT_STARTED";

export type FarmerPlanCard = {
  planId: string;
  cropId: string | null;
  cropName: string;
  cropVariety: string | null;
  harvestType: "SINGLE" | "CONTINUOUS" | null;
  unit: string | null;
  status: PlanStatus;
  locationDescription: string | null;
  plantedAreaHa: number;
  targetKg: number;
  realizedKg: number;
  pendingKg: number;
  completionPct: number;
  progressStatus: ProgressStatus;
  plantingDate: string | null;
  expectedHarvestStart: string | null;
  expectedHarvestEnd: string | null;
  lastExecutionDate: string | null;
};

export type FarmerSummary = {
  farmerId: string | null;
  farmerName: string | null;
  communityName: string | null;
  currentHarvest: {
    id: string;
    label: string;
    startDate: string | null;
    endDate: string | null;
  } | null;
  isEmpty: boolean;
  totalPlansCount: number;
  activePlotsCount: number;
  totalPlantedAreaHa: number;
  totalTargetKg: number;
  totalRealizedKg: number;
  totalPendingKg: number;
  overallCompletionPct: number;
  plans: FarmerPlanCard[];
};

export type HarvestTimelineResponse = {
  planId: string | null;
  harvestType: "SINGLE" | "CONTINUOUS";
  granularity: TimelineGranularity;
  unit: "kg";
  points: TimelinePoint[];
};

type Raw = Record<string, unknown>;

/** BigDecimal pode chegar como number ou string; nulo/ inválido vira 0. */
export function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

const str = (value: unknown): string | null =>
  typeof value === "string" && value !== "" ? value : null;

const PROGRESS: ProgressStatus[] = [
  "GOAL_REACHED",
  "ON_TRACK",
  "BELOW_EXPECTED",
  "DELAYED",
  "NOT_STARTED",
];

// Sem `planId` o cartão não tem chave nem link: é descartado em vez de virar
// um plano "undefined".
function mapCard(raw: Raw): FarmerPlanCard | null {
  const planId = str(raw.planId);
  if (!planId) return null;
  const progress = PROGRESS.find((p) => p === raw.progressStatus);
  const harvestType =
    raw.harvestType === "SINGLE" || raw.harvestType === "CONTINUOUS"
      ? raw.harvestType
      : null;
  return {
    planId,
    cropId: str(raw.cropId),
    cropName: str(raw.cropName) ?? "Cultura",
    cropVariety: str(raw.cropVariety),
    harvestType,
    unit: str(raw.unit),
    status: (str(raw.status) ?? "PLANNED") as PlanStatus,
    locationDescription: str(raw.locationDescription),
    plantedAreaHa: toNumber(raw.plantedAreaHa),
    targetKg: toNumber(raw.targetKg),
    realizedKg: toNumber(raw.realizedKg),
    pendingKg: toNumber(raw.pendingKg),
    completionPct: toNumber(raw.completionPct),
    progressStatus: progress ?? "NOT_STARTED",
    plantingDate: str(raw.plantingDate),
    expectedHarvestStart: str(raw.expectedHarvestStart),
    expectedHarvestEnd: str(raw.expectedHarvestEnd),
    lastExecutionDate: str(raw.lastExecutionDate),
  };
}

export function mapFarmerSummary(raw: Raw): FarmerSummary {
  const harvest = raw.currentHarvest as Raw | null | undefined;
  const plans = Array.isArray(raw.plans)
    ? (raw.plans as Raw[])
        .map(mapCard)
        .filter((card): card is FarmerPlanCard => card !== null)
    : [];
  return {
    farmerId: str(raw.farmerId),
    farmerName: str(raw.farmerName),
    communityName: str(raw.communityName),
    currentHarvest: harvest
      ? {
          id: String(harvest.id),
          label: str(harvest.label) ?? "",
          startDate: str(harvest.startDate),
          endDate: str(harvest.endDate),
        }
      : null,
    isEmpty: Boolean(raw.isEmpty) || plans.length === 0,
    totalPlansCount: toNumber(raw.totalPlansCount),
    activePlotsCount: toNumber(raw.activePlotsCount),
    totalPlantedAreaHa: toNumber(raw.totalPlantedAreaHa),
    totalTargetKg: toNumber(raw.totalTargetKg),
    totalRealizedKg: toNumber(raw.totalRealizedKg),
    totalPendingKg: toNumber(raw.totalPendingKg),
    overallCompletionPct: toNumber(raw.overallCompletionPct),
    plans,
  };
}

export function mapTimeline(raw: Raw): HarvestTimelineResponse {
  const points = Array.isArray(raw.points) ? (raw.points as Raw[]) : [];
  return {
    planId: str(raw.planId),
    harvestType: raw.harvestType === "CONTINUOUS" ? "CONTINUOUS" : "SINGLE",
    granularity: raw.granularity === "MONTH" ? "MONTH" : "WEEK",
    unit: "kg",
    points: points.map((p) => ({
      date: String(p.date),
      expectedValue:
        p.expectedValue === null || p.expectedValue === undefined
          ? null
          : toNumber(p.expectedValue),
      actualValue: toNumber(p.actualValue),
      pendingValue: toNumber(p.pendingValue),
    })),
  };
}

/** `GET /analytics/farmers/me/summary` (só FARMER); `harvestId` só se informado. */
export function getFarmerSummary(harvestId?: string) {
  const query = harvestId ? `?harvestId=${encodeURIComponent(harvestId)}` : "";
  return apiRequest<Raw>(`/analytics/farmers/me/summary${query}`, {
    method: "GET",
  }).then(mapFarmerSummary);
}

/** `GET /analytics/plans/:id/timeline?granularity=WEEK|MONTH`. */
export function getHarvestTimeline(
  planId: string,
  granularity: TimelineGranularity = "WEEK",
) {
  return apiRequest<Raw>(
    `/analytics/plans/${encodeURIComponent(planId)}/timeline?granularity=${granularity}`,
    { method: "GET" },
  ).then(mapTimeline);
}
