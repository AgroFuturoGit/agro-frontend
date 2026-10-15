import { apiRequest } from "@/lib/api";
import { mapCrop, type Crop } from "@/lib/crops";

// ----- Tipos de domínio (front) -----

export type PlanStatus = "PLANNED" | "ACTIVE" | "FINISHED" | "CANCELED";
export type ExecutionStatus = "PENDING" | "VALIDATED" | "REJECTED";

export const PLAN_STATUSES: PlanStatus[] = [
  "PLANNED",
  "ACTIVE",
  "FINISHED",
  "CANCELED",
];

export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  PLANNED: "Planejado",
  ACTIVE: "Ativo",
  FINISHED: "Finalizado",
  CANCELED: "Cancelado",
};

export const EXECUTION_STATUS_LABELS: Record<ExecutionStatus, string> = {
  PENDING: "Pendente",
  VALIDATED: "Validado",
  REJECTED: "Rejeitado",
};

export type PlanHarvest = {
  id: string;
  label: string;
  startDate: string | null;
  endDate: string | null;
};

export type ProductionPlan = {
  id: string;
  crop: Crop | null;
  harvest: PlanHarvest | null;
  plantedArea: number;
  status: PlanStatus | null;
  expectedHarvestStart: string | null;
  expectedHarvestEnd: string | null;
  /** Produtividade copiada da cultura na criação (kg/ha, assumido). */
  expectedProductivity: number | null;
  /** Meta derivada em kg: `plantedArea × expectedProductivity` (0 se ausente). */
  expectedYield: number;
  plannedPlantingDate: string | null;
  createdAt: string | null;
};

export type ProductionExecution = {
  id: string;
  productionPlanId: string;
  quantity: number;
  quantityKg: number;
  harvestedAt: string | null;
  status: ExecutionStatus | null;
  notes: string | null;
  createdAt: string | null;
};

export type ProductionComparison = {
  productionPlanId: string;
  expectedYield: number;
  totalActualYield: number;
  difference: number;
  percentageRealized: number;
};

// ----- Payloads -----

// ProductionPlanRegisterDTO — a produtividade é copiada da cultura no back.
export type ProductionPlanCreatePayload = {
  harvestId: string;
  cropId: string;
  plantedArea: number;
  expectedHarvestStart?: string | null;
  expectedHarvestEnd?: string | null;
  plannedPlantingDate?: string | null;
};

// ProductionPlanUpdateDTO — campo null = "manter valor atual".
export type ProductionPlanUpdatePayload = {
  plantedArea: number;
  status?: PlanStatus | null;
  expectedHarvestStart?: string | null;
  expectedHarvestEnd?: string | null;
  expectedProductivity?: number | null;
  plannedPlantingDate?: string | null;
};

// Nunca inclui status/validatedBy/validatedAt: a validação não é do front.
export type ProductionExecutionWritePayload = {
  quantity: number;
  quantityKg: number;
  harvestedAt: string;
  notes?: string | null;
};

// ----- Tipos de resposta da API -----

type PlanApiResponse = {
  id: string;
  crop: Parameters<typeof mapCrop>[0] | null;
  harvest: {
    id: string;
    label: string;
    startDate: string | null;
    endDate: string | null;
  } | null;
  plantedArea: number | string;
  status?: string | null;
  expectedHarvestStart?: string | null;
  expectedHarvestEnd?: string | null;
  expectedProductivity?: number | string | null;
  plannedPlantingDate: string | null;
  createdAt: string | null;
};

type ExecutionApiResponse = {
  id: string;
  productionPlanId: string;
  quantity: number | string;
  quantityKg: number | string;
  harvestedAt: string | null;
  status?: string | null;
  notes?: string | null;
  createdAt?: string | null;
};

type ComparisonApiResponse = {
  productionPlanId: string;
  expectedYield: number | string;
  totalActualYield: number | string;
  difference: number | string;
  percentageRealized: number | string;
};

function num(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function numOrNull(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePlanStatus(value: unknown): PlanStatus | null {
  return PLAN_STATUSES.includes(value as PlanStatus)
    ? (value as PlanStatus)
    : null;
}

function parseExecutionStatus(value: unknown): ExecutionStatus | null {
  return value === "PENDING" || value === "VALIDATED" || value === "REJECTED"
    ? value
    : null;
}

function mapPlan(raw: PlanApiResponse): ProductionPlan {
  const plantedArea = num(raw.plantedArea);
  const expectedProductivity = numOrNull(raw.expectedProductivity);
  return {
    id: raw.id,
    crop: raw.crop ? mapCrop(raw.crop) : null,
    harvest: raw.harvest
      ? {
          id: raw.harvest.id,
          label: raw.harvest.label,
          startDate: raw.harvest.startDate ?? null,
          endDate: raw.harvest.endDate ?? null,
        }
      : null,
    plantedArea,
    status: parsePlanStatus(raw.status),
    expectedHarvestStart: raw.expectedHarvestStart ?? null,
    expectedHarvestEnd: raw.expectedHarvestEnd ?? null,
    expectedProductivity,
    expectedYield: plantedArea * (expectedProductivity ?? 0),
    plannedPlantingDate: raw.plannedPlantingDate ?? null,
    createdAt: raw.createdAt ?? null,
  };
}

function mapExecution(raw: ExecutionApiResponse): ProductionExecution {
  return {
    id: raw.id,
    productionPlanId: raw.productionPlanId,
    quantity: num(raw.quantity),
    quantityKg: num(raw.quantityKg),
    harvestedAt: raw.harvestedAt ?? null,
    status: parseExecutionStatus(raw.status),
    notes: raw.notes ?? null,
    createdAt: raw.createdAt ?? null,
  };
}

function mapComparison(raw: ComparisonApiResponse): ProductionComparison {
  return {
    productionPlanId: raw.productionPlanId,
    expectedYield: num(raw.expectedYield),
    totalActualYield: num(raw.totalActualYield),
    difference: num(raw.difference),
    percentageRealized: num(raw.percentageRealized),
  };
}

// ----- Planos de produção -----

export function listProductionPlans(producerId: string) {
  return apiRequest<PlanApiResponse[]>(
    `/farmers/${producerId}/production-plans`,
    { method: "GET" },
  ).then((res) => res.map(mapPlan));
}

export function getProductionPlan(planId: string) {
  return apiRequest<PlanApiResponse>(`/production-plans/${planId}`, {
    method: "GET",
  }).then(mapPlan);
}

export function createProductionPlan(
  producerId: string,
  payload: ProductionPlanCreatePayload,
) {
  return apiRequest<PlanApiResponse>(
    `/farmers/${producerId}/production-plans`,
    { method: "POST", body: payload },
  ).then(mapPlan);
}

export function updateProductionPlan(
  planId: string,
  payload: ProductionPlanUpdatePayload,
) {
  return apiRequest<PlanApiResponse>(`/production-plans/${planId}`, {
    method: "PUT",
    body: payload,
  }).then(mapPlan);
}

export function deleteProductionPlan(planId: string) {
  return apiRequest<void>(`/production-plans/${planId}`, { method: "DELETE" });
}

// ----- Apontamentos (execuções) -----

export function listProductionExecutions(planId: string) {
  return apiRequest<ExecutionApiResponse[]>(
    `/production-plans/${planId}/executions`,
    { method: "GET" },
  ).then((res) => res.map(mapExecution));
}

export function createProductionExecution(
  planId: string,
  payload: ProductionExecutionWritePayload,
) {
  return apiRequest<ExecutionApiResponse>(
    `/production-plans/${planId}/executions`,
    { method: "POST", body: payload },
  ).then(mapExecution);
}

export function updateProductionExecution(
  executionId: string,
  payload: ProductionExecutionWritePayload,
) {
  return apiRequest<ExecutionApiResponse>(
    `/production-executions/${executionId}`,
    { method: "PUT", body: payload },
  ).then(mapExecution);
}

export function deleteProductionExecution(executionId: string) {
  return apiRequest<void>(`/production-executions/${executionId}`, {
    method: "DELETE",
  });
}

// ----- Comparação previsto vs realizado -----

export function getProductionComparison(planId: string) {
  return apiRequest<ComparisonApiResponse>(
    `/production-plans/${planId}/comparison`,
    { method: "GET" },
  ).then(mapComparison);
}

// ----- Formatadores -----

export function formatNumber(value: number, fractionDigits = 2): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  });
}

export function formatPlanDate(value: string | null | undefined): string {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (match) {
    const [, year, month, day] = match;
    return `${day}/${month}/${year}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR");
}
