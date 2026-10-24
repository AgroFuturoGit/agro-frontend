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

export type WarningType =
  | "INACTIVE_EXECUTIONS"
  | "LOW_YIELD_RISK"
  | "HARVEST_OVERDUE";

export type WarningSeverity = "MEDIUM" | "HIGH";

export type TechnicianWarning = {
  planId: string;
  farmerId: string | null;
  farmerName: string | null;
  communityId: string | null;
  communityName: string | null;
  cropId: string | null;
  cropName: string;
  cropVariety: string | null;
  planStatus: PlanStatus;
  progressStatus: ProgressStatus;
  warningTypes: WarningType[];
  severity: WarningSeverity;
  message: string;
  targetKg: number;
  realizedKg: number;
  pendingKg: number;
  expectedPaceKg: number;
  completionPct: number;
  lastExecutionDate: string | null;
  daysWithoutExecution: number | null;
  expectedHarvestStart: string | null;
  expectedHarvestEnd: string | null;
};

export type TechnicianCommunitySummary = {
  communityId: string;
  communityName: string;
  assistedFarmersCount: number;
  farmersWithPlansCount: number;
  plansCount: number;
  plantedAreaHa: number;
  targetKg: number;
  realizedKg: number;
  pendingKg: number;
  completionPct: number;
  warningsCount: number;
};

export type TechnicianFarmerSummary = {
  farmerId: string;
  farmerName: string;
  communityId: string | null;
  communityName: string | null;
  isCompliant: boolean;
  plansCount: number;
  activePlansCount: number;
  plantedAreaHa: number;
  targetKg: number;
  realizedKg: number;
  pendingKg: number;
  completionPct: number;
  lastExecutionDate: string | null;
  warningsCount: number;
};

export type TechnicianSummary = {
  technicianId: string | null;
  technicianName: string | null;
  currentHarvest: FarmerSummary["currentHarvest"];
  appliedCommunityId: string | null;
  appliedCropId: string | null;
  isEmpty: boolean;
  totalAssistedCommunitiesCount: number;
  totalAssistedFarmersCount: number;
  totalPlansCount: number;
  activePlansCount: number;
  totalPlantedAreaHa: number;
  totalTargetKg: number;
  totalRealizedKg: number;
  totalPendingKg: number;
  pendingExecutionsCount: number;
  overallCompletionPct: number;
  totalWarningsCount: number;
  warnings: TechnicianWarning[];
  communities: TechnicianCommunitySummary[];
  farmers: TechnicianFarmerSummary[];
};

export type TechnicianSummaryParams = {
  harvestId?: string;
  communityId?: string;
  cropId?: string;
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

const WARNING_TYPES: WarningType[] = [
  "INACTIVE_EXECUTIONS",
  "LOW_YIELD_RISK",
  "HARVEST_OVERDUE",
];

function list(value: unknown): Raw[] {
  return Array.isArray(value) ? (value as Raw[]) : [];
}

function nullableNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : toNumber(value);
}

// Sem `planId` o alerta não tem chave nem link: é descartado.
function mapWarning(raw: Raw): TechnicianWarning | null {
  const planId = str(raw.planId);
  if (!planId) return null;
  const types = Array.isArray(raw.warningTypes)
    ? WARNING_TYPES.filter((t) => (raw.warningTypes as unknown[]).includes(t))
    : [];
  return {
    planId,
    farmerId: str(raw.farmerId),
    farmerName: str(raw.farmerName),
    communityId: str(raw.communityId),
    communityName: str(raw.communityName),
    cropId: str(raw.cropId),
    cropName: str(raw.cropName) ?? "Cultura",
    cropVariety: str(raw.cropVariety),
    planStatus: (str(raw.planStatus) ?? "PLANNED") as PlanStatus,
    progressStatus: PROGRESS.find((p) => p === raw.progressStatus) ?? "NOT_STARTED",
    warningTypes: types,
    severity: raw.severity === "HIGH" ? "HIGH" : "MEDIUM",
    message: str(raw.message) ?? "",
    targetKg: toNumber(raw.targetKg),
    realizedKg: toNumber(raw.realizedKg),
    pendingKg: toNumber(raw.pendingKg),
    expectedPaceKg: toNumber(raw.expectedPaceKg),
    completionPct: toNumber(raw.completionPct),
    lastExecutionDate: str(raw.lastExecutionDate),
    daysWithoutExecution: nullableNumber(raw.daysWithoutExecution),
    expectedHarvestStart: str(raw.expectedHarvestStart),
    expectedHarvestEnd: str(raw.expectedHarvestEnd),
  };
}

function mapCommunity(raw: Raw): TechnicianCommunitySummary | null {
  const communityId = str(raw.communityId);
  if (!communityId) return null;
  return {
    communityId,
    communityName: str(raw.communityName) ?? "Comunidade",
    assistedFarmersCount: toNumber(raw.assistedFarmersCount),
    farmersWithPlansCount: toNumber(raw.farmersWithPlansCount),
    plansCount: toNumber(raw.plansCount),
    plantedAreaHa: toNumber(raw.plantedAreaHa),
    targetKg: toNumber(raw.targetKg),
    realizedKg: toNumber(raw.realizedKg),
    pendingKg: toNumber(raw.pendingKg),
    completionPct: toNumber(raw.completionPct),
    warningsCount: toNumber(raw.warningsCount),
  };
}

function mapTechnicianFarmer(raw: Raw): TechnicianFarmerSummary | null {
  const farmerId = str(raw.farmerId);
  if (!farmerId) return null;
  return {
    farmerId,
    farmerName: str(raw.farmerName) ?? "Agricultor",
    communityId: str(raw.communityId),
    communityName: str(raw.communityName),
    isCompliant: Boolean(raw.isCompliant),
    plansCount: toNumber(raw.plansCount),
    activePlansCount: toNumber(raw.activePlansCount),
    plantedAreaHa: toNumber(raw.plantedAreaHa),
    targetKg: toNumber(raw.targetKg),
    realizedKg: toNumber(raw.realizedKg),
    pendingKg: toNumber(raw.pendingKg),
    completionPct: toNumber(raw.completionPct),
    lastExecutionDate: str(raw.lastExecutionDate),
    warningsCount: toNumber(raw.warningsCount),
  };
}

export function mapTechnicianSummary(raw: Raw): TechnicianSummary {
  const harvest = raw.currentHarvest as Raw | null | undefined;
  const warnings = list(raw.warnings)
    .map(mapWarning)
    .filter((w): w is TechnicianWarning => w !== null);
  const communities = list(raw.communities)
    .map(mapCommunity)
    .filter((c): c is TechnicianCommunitySummary => c !== null);
  const farmers = list(raw.farmers)
    .map(mapTechnicianFarmer)
    .filter((f): f is TechnicianFarmerSummary => f !== null);
  return {
    technicianId: str(raw.technicianId),
    technicianName: str(raw.technicianName),
    currentHarvest: harvest
      ? {
          id: String(harvest.id),
          label: str(harvest.label) ?? "",
          startDate: str(harvest.startDate),
          endDate: str(harvest.endDate),
        }
      : null,
    appliedCommunityId: str(raw.appliedCommunityId),
    appliedCropId: str(raw.appliedCropId),
    isEmpty: Boolean(raw.isEmpty),
    totalAssistedCommunitiesCount: toNumber(raw.totalAssistedCommunitiesCount),
    totalAssistedFarmersCount: toNumber(raw.totalAssistedFarmersCount),
    totalPlansCount: toNumber(raw.totalPlansCount),
    activePlansCount: toNumber(raw.activePlansCount),
    totalPlantedAreaHa: toNumber(raw.totalPlantedAreaHa),
    totalTargetKg: toNumber(raw.totalTargetKg),
    totalRealizedKg: toNumber(raw.totalRealizedKg),
    totalPendingKg: toNumber(raw.totalPendingKg),
    pendingExecutionsCount: toNumber(raw.pendingExecutionsCount),
    overallCompletionPct: toNumber(raw.overallCompletionPct),
    totalWarningsCount:
      raw.totalWarningsCount === undefined
        ? warnings.length
        : toNumber(raw.totalWarningsCount),
    warnings,
    communities,
    farmers,
  };
}

/**
 * `GET /analytics/technicians/me/summary` (só TECHNICIAN); cada filtro só vai
 * na query se informado.
 */
export function getTechnicianSummary(params: TechnicianSummaryParams = {}) {
  const query = new URLSearchParams();
  if (params.harvestId) query.set("harvestId", params.harvestId);
  if (params.communityId) query.set("communityId", params.communityId);
  if (params.cropId) query.set("cropId", params.cropId);
  const qs = query.toString();
  return apiRequest<Raw>(
    `/analytics/technicians/me/summary${qs ? `?${qs}` : ""}`,
    { method: "GET" },
  ).then(mapTechnicianSummary);
}

export type ManagementScope = "ORGANIZATION" | "GLOBAL";

export type ManagementCropRankingItem = {
  rankPosition: number;
  cropId: string | null;
  cropName: string;
  cropVariety: string | null;
  unit: string | null;
  plansCount: number;
  plantedAreaHa: number;
  targetKg: number;
  realizedKg: number;
  conversionRatePct: number;
  productionSharePct: number;
};

export type ManagementCommunityPerformance = {
  communityId: string;
  communityName: string;
  organizationId: string | null;
  organizationName: string | null;
  activeFarmersCount: number;
  compliantFarmersCount: number;
  complianceRatePct: number;
  plansCount: number;
  plantedAreaHa: number;
  targetKg: number;
  realizedKg: number;
  conversionRatePct: number;
  lastExecutionDate: string | null;
};

export type ManagementOrganizationSummary = {
  organizationId: string;
  organizationName: string;
  communitiesCount: number;
  activeFarmersCount: number;
  compliantFarmersCount: number;
  complianceRatePct: number;
  plansCount: number;
  plantedAreaHa: number;
  targetKg: number;
  realizedKg: number;
  conversionRatePct: number;
};

export type ManagementSummary = {
  scope: ManagementScope;
  organizationId: string | null;
  organizationName: string | null;
  currentHarvest: FarmerSummary["currentHarvest"];
  appliedCommunityId: string | null;
  isEmpty: boolean;
  totalOrganizationsCount: number;
  totalCommunitiesCount: number;
  totalFarmersCount: number;
  compliantFarmersCount: number;
  complianceRatePct: number;
  totalPlansCount: number;
  totalPlantedAreaHa: number;
  totalTargetKg: number;
  totalRealizedKg: number;
  overallConversionRatePct: number;
  cropRanking: ManagementCropRankingItem[];
  communities: ManagementCommunityPerformance[];
  organizations: ManagementOrganizationSummary[];
};

export type ManagementSummaryParams = {
  harvestId?: string;
  communityId?: string;
  /** Só usado em `getGlobalSummary` (filtro do admin). */
  organizationId?: string;
};

function mapRankingItem(raw: Raw, index: number): ManagementCropRankingItem {
  return {
    rankPosition: raw.rankPosition === undefined ? index + 1 : toNumber(raw.rankPosition),
    cropId: str(raw.cropId),
    cropName: str(raw.cropName) ?? "Cultura",
    cropVariety: str(raw.cropVariety),
    unit: str(raw.unit),
    plansCount: toNumber(raw.plansCount),
    plantedAreaHa: toNumber(raw.plantedAreaHa),
    targetKg: toNumber(raw.targetKg),
    realizedKg: toNumber(raw.realizedKg),
    conversionRatePct: toNumber(raw.conversionRatePct),
    productionSharePct: toNumber(raw.productionSharePct),
  };
}

function mapManagementCommunity(raw: Raw): ManagementCommunityPerformance | null {
  const communityId = str(raw.communityId);
  if (!communityId) return null;
  return {
    communityId,
    communityName: str(raw.communityName) ?? "Comunidade",
    organizationId: str(raw.organizationId),
    organizationName: str(raw.organizationName),
    activeFarmersCount: toNumber(raw.activeFarmersCount),
    compliantFarmersCount: toNumber(raw.compliantFarmersCount),
    complianceRatePct: toNumber(raw.complianceRatePct),
    plansCount: toNumber(raw.plansCount),
    plantedAreaHa: toNumber(raw.plantedAreaHa),
    targetKg: toNumber(raw.targetKg),
    realizedKg: toNumber(raw.realizedKg),
    conversionRatePct: toNumber(raw.conversionRatePct),
    lastExecutionDate: str(raw.lastExecutionDate),
  };
}

function mapManagementOrganization(raw: Raw): ManagementOrganizationSummary | null {
  const organizationId = str(raw.organizationId);
  if (!organizationId) return null;
  return {
    organizationId,
    organizationName: str(raw.organizationName) ?? "Organização",
    communitiesCount: toNumber(raw.communitiesCount),
    activeFarmersCount: toNumber(raw.activeFarmersCount),
    compliantFarmersCount: toNumber(raw.compliantFarmersCount),
    complianceRatePct: toNumber(raw.complianceRatePct),
    plansCount: toNumber(raw.plansCount),
    plantedAreaHa: toNumber(raw.plantedAreaHa),
    targetKg: toNumber(raw.targetKg),
    realizedKg: toNumber(raw.realizedKg),
    conversionRatePct: toNumber(raw.conversionRatePct),
  };
}

export function mapManagementSummary(raw: Raw): ManagementSummary {
  const harvest = raw.currentHarvest as Raw | null | undefined;
  return {
    scope: raw.scope === "GLOBAL" ? "GLOBAL" : "ORGANIZATION",
    organizationId: str(raw.organizationId),
    organizationName: str(raw.organizationName),
    currentHarvest: harvest
      ? {
          id: String(harvest.id),
          label: str(harvest.label) ?? "",
          startDate: str(harvest.startDate),
          endDate: str(harvest.endDate),
        }
      : null,
    appliedCommunityId: str(raw.appliedCommunityId),
    isEmpty: Boolean(raw.isEmpty),
    totalOrganizationsCount: toNumber(raw.totalOrganizationsCount),
    totalCommunitiesCount: toNumber(raw.totalCommunitiesCount),
    totalFarmersCount: toNumber(raw.totalFarmersCount),
    compliantFarmersCount: toNumber(raw.compliantFarmersCount),
    complianceRatePct: toNumber(raw.complianceRatePct),
    totalPlansCount: toNumber(raw.totalPlansCount),
    totalPlantedAreaHa: toNumber(raw.totalPlantedAreaHa),
    totalTargetKg: toNumber(raw.totalTargetKg),
    totalRealizedKg: toNumber(raw.totalRealizedKg),
    overallConversionRatePct: toNumber(raw.overallConversionRatePct),
    cropRanking: list(raw.cropRanking).map(mapRankingItem),
    communities: list(raw.communities)
      .map(mapManagementCommunity)
      .filter((c): c is ManagementCommunityPerformance => c !== null),
    organizations: list(raw.organizations)
      .map(mapManagementOrganization)
      .filter((o): o is ManagementOrganizationSummary => o !== null),
  };
}

function managementQuery(params: ManagementSummaryParams, withOrg: boolean): string {
  const query = new URLSearchParams();
  if (params.harvestId) query.set("harvestId", params.harvestId);
  if (withOrg && params.organizationId) query.set("organizationId", params.organizationId);
  if (params.communityId) query.set("communityId", params.communityId);
  const qs = query.toString();
  return qs ? `?${qs}` : "";
}

/** `GET /analytics/organizations/me/summary` (só MANAGER; a organização vem do token). */
export function getManagerSummary(params: ManagementSummaryParams = {}) {
  return apiRequest<Raw>(
    `/analytics/organizations/me/summary${managementQuery(params, false)}`,
    { method: "GET" },
  ).then(mapManagementSummary);
}

/** `GET /analytics/organizations/:id/summary` (ADMIN qualquer; MANAGER só a sua). */
export function getOrganizationSummary(
  organizationId: string,
  params: ManagementSummaryParams = {},
) {
  return apiRequest<Raw>(
    `/analytics/organizations/${encodeURIComponent(organizationId)}/summary${managementQuery(params, false)}`,
    { method: "GET" },
  ).then(mapManagementSummary);
}

/** `GET /analytics/global/summary` (só ADMIN); filtros só vão se informados. */
export function getGlobalSummary(params: ManagementSummaryParams = {}) {
  return apiRequest<Raw>(
    `/analytics/global/summary${managementQuery(params, true)}`,
    { method: "GET" },
  ).then(mapManagementSummary);
}
