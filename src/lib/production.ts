import { apiRequest } from "@/lib/api";

// ----- Tipos de domínio (front) -----

export type PlanCrop = {
  id: string;
  name: string;
  variety: string;
};

export type PlanHarvest = {
  id: string;
  label: string;
  startDate: string | null;
  endDate: string | null;
};

export type ProductionPlan = {
  id: string;
  crop: PlanCrop | null;
  harvest: PlanHarvest | null;
  plantedArea: number;
  expectedYield: number;
  plannedPlantingDate: string | null;
  createdAt: string | null;
};

export type ProductionExecution = {
  id: string;
  productionPlanId: string;
  actualYield: number;
  harvestDate: string | null;
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

export type ProductionPlanCreatePayload = {
  harvestId: string;
  cropId: string;
  plantedArea: number;
  expectedYield: number;
  plannedPlantingDate?: string | null;
};

export type ProductionPlanUpdatePayload = {
  plantedArea: number;
  expectedYield: number;
  plannedPlantingDate?: string | null;
};

export type ProductionExecutionWritePayload = {
  actualYield: number;
  harvestDate: string;
};

// ----- Tipos de resposta da API -----

type PlanApiResponse = {
  id: string;
  crop: { id: string; name: string; variety: string } | null;
  harvest: {
    id: string;
    label: string;
    startDate: string | null;
    endDate: string | null;
  } | null;
  plantedArea: number | string;
  expectedYield: number | string;
  plannedPlantingDate: string | null;
  createdAt: string | null;
};

type ExecutionApiResponse = {
  id: string;
  productionPlanId: string;
  actualYield: number | string;
  harvestDate: string | null;
  createdAt: string | null;
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

function mapPlan(raw: PlanApiResponse): ProductionPlan {
  return {
    id: raw.id,
    crop: raw.crop
      ? { id: raw.crop.id, name: raw.crop.name, variety: raw.crop.variety }
      : null,
    harvest: raw.harvest
      ? {
          id: raw.harvest.id,
          label: raw.harvest.label,
          startDate: raw.harvest.startDate ?? null,
          endDate: raw.harvest.endDate ?? null,
        }
      : null,
    plantedArea: num(raw.plantedArea),
    expectedYield: num(raw.expectedYield),
    plannedPlantingDate: raw.plannedPlantingDate ?? null,
    createdAt: raw.createdAt ?? null,
  };
}

function mapExecution(raw: ExecutionApiResponse): ProductionExecution {
  return {
    id: raw.id,
    productionPlanId: raw.productionPlanId,
    actualYield: num(raw.actualYield),
    harvestDate: raw.harvestDate ?? null,
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
    `/producers/${producerId}/production-plans`,
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
    `/producers/${producerId}/production-plans`,
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
