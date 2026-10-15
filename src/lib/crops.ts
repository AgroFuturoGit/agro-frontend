import { apiRequest } from "@/lib/api";

export type HarvestType = "SINGLE" | "CONTINUOUS";
export type MeasurementUnit = "KG" | "TON" | "SACK" | "BOX";

export const HARVEST_TYPES: HarvestType[] = ["SINGLE", "CONTINUOUS"];
export const MEASUREMENT_UNITS: MeasurementUnit[] = ["KG", "TON", "SACK", "BOX"];

export type Crop = {
  id: string;
  name: string;
  variety: string;
  isPriority: boolean;
  cycleDays: number | null;
  expectedProductivity: number | null;
  harvestType: HarvestType | null;
  unit: MeasurementUnit | null;
  unitWeightKg: number | null;
  updatedAt?: string;
};

// O PATCH /crops/{id} substitui tudo: omitir um campo grava null. Por isso
// o payload sempre carrega os 8 campos de escrita.
export type CropWritePayload = {
  name: string;
  variety: string;
  isPriority: boolean;
  cycleDays: number | null;
  expectedProductivity: number | null;
  harvestType: HarvestType | null;
  unit: MeasurementUnit | null;
  unitWeightKg: number | null;
};

type CropApiResponse = {
  id: string;
  name: string;
  variety: string;
  isPriority: boolean;
  cycleDays?: number | string | null;
  expectedProductivity?: number | string | null;
  harvestType?: string | null;
  unit?: string | null;
  unitWeightKg?: number | string | null;
};

function numOrNull(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseHarvestType(value: unknown): HarvestType | null {
  return HARVEST_TYPES.includes(value as HarvestType)
    ? (value as HarvestType)
    : null;
}

export function parseMeasurementUnit(value: unknown): MeasurementUnit | null {
  return MEASUREMENT_UNITS.includes(value as MeasurementUnit)
    ? (value as MeasurementUnit)
    : null;
}

export function mapCrop(raw: CropApiResponse): Crop {
  return {
    id: raw.id,
    name: raw.name,
    variety: raw.variety,
    isPriority: raw.isPriority,
    cycleDays: numOrNull(raw.cycleDays),
    expectedProductivity: numOrNull(raw.expectedProductivity),
    harvestType: parseHarvestType(raw.harvestType),
    unit: parseMeasurementUnit(raw.unit),
    unitWeightKg: numOrNull(raw.unitWeightKg),
  };
}

/**
 * Fator de conversão da unidade da cultura para kg. KG=1, TON=1000,
 * SACK/BOX=unitWeightKg, sem unidade (legado)=1. Retorna null quando
 * SACK/BOX não tem peso válido (apontamento deve ser bloqueado).
 */
export function unitFactorKg(
  crop: Pick<Crop, "unit" | "unitWeightKg"> | null | undefined,
): number | null {
  const unit = crop?.unit ?? null;
  if (unit === null || unit === "KG") return 1;
  if (unit === "TON") return 1000;
  const weight = crop?.unitWeightKg ?? null;
  return weight !== null && weight > 0 ? weight : null;
}

const UNIT_LABELS: Record<MeasurementUnit, [string, string]> = {
  KG: ["kg", "kg"],
  TON: ["t", "t"],
  SACK: ["saca", "sacas"],
  BOX: ["caixa", "caixas"],
};

export function unitLabel(unit: MeasurementUnit | null, quantity = 2): string {
  const labels = UNIT_LABELS[unit ?? "KG"];
  return quantity === 1 ? labels[0] : labels[1];
}

export const HARVEST_TYPE_LABELS: Record<HarvestType, string> = {
  SINGLE: "Colheita única",
  CONTINUOUS: "Colheita contínua",
};

export const UNIT_NAMES: Record<MeasurementUnit, string> = {
  KG: "Quilograma (kg)",
  TON: "Tonelada (t)",
  SACK: "Saca",
  BOX: "Caixa",
};

export async function listCrops(): Promise<Crop[]> {
  return apiRequest<CropApiResponse[]>("/crops", { method: "GET" }).then(
    (res) => res.map(mapCrop),
  );
}

export function getCrop(id: string) {
  return apiRequest<CropApiResponse>(`/crops/${id}`, { method: "GET" }).then(
    mapCrop,
  );
}

export function createCrop(payload: CropWritePayload) {
  return apiRequest<CropApiResponse>("/crops/register", {
    method: "POST",
    body: payload,
  }).then(mapCrop);
}

export function updateCrop(id: string, payload: CropWritePayload) {
  return apiRequest<CropApiResponse>(`/crops/${id}`, {
    method: "PATCH",
    body: payload,
  }).then(mapCrop);
}

export function deleteCrop(id: string) {
  return apiRequest<void>(`/crops/${id}`, { method: "DELETE" });
}

// Backend retorna erros de validação como: "name: msg; variety: msg"
export function parseCropFieldErrors(payload: unknown): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!payload || typeof payload !== "object") return errors;

  const record = payload as Record<string, unknown>;
  const message = typeof record.message === "string" ? record.message : "";

  if (message) {
    for (const part of message.split(";")) {
      const colonIdx = part.indexOf(":");
      if (colonIdx === -1) continue;
      const field = part.slice(0, colonIdx).trim();
      const msg = part.slice(colonIdx + 1).trim();
      if (field && msg) errors[field] = msg;
    }
  }

  return errors;
}
