import { apiRequest, parseFieldErrors } from "@/lib/api";

export type OccurrenceType = "CLIMATE" | "PEST" | "DISEASE";

export const OCCURRENCE_TYPES: OccurrenceType[] = ["CLIMATE", "PEST", "DISEASE"];

export const OCCURRENCE_TYPE_LABELS: Record<OccurrenceType, string> = {
  CLIMATE: "Evento climático",
  PEST: "Praga",
  DISEASE: "Doença",
};

export type FieldOccurrence = {
  id: string;
  executionId: string;
  logType: OccurrenceType | null;
  description: string;
  weatherObservation: string | null;
  evidenceUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

// Na edição o PUT leva todos os campos atuais. O back ignora `null` no PUT: para
// limpar um opcional é preciso enviar ""; no cadastro, opcional vazio vai null.
export type FieldOccurrencePayload = {
  logType: OccurrenceType;
  description: string;
  weatherObservation?: string | null;
  evidenceUrl?: string | null;
};

type OccurrenceApiResponse = {
  id: string;
  executionId: string;
  logType?: string | null;
  description?: string | null;
  weatherObservation?: string | null;
  evidenceUrl?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export function parseOccurrenceType(value: unknown): OccurrenceType | null {
  return OCCURRENCE_TYPES.includes(value as OccurrenceType)
    ? (value as OccurrenceType)
    : null;
}

export function mapOccurrence(raw: OccurrenceApiResponse): FieldOccurrence {
  return {
    id: raw.id,
    executionId: raw.executionId,
    logType: parseOccurrenceType(raw.logType),
    description: raw.description ?? "",
    weatherObservation: raw.weatherObservation || null,
    evidenceUrl: raw.evidenceUrl || null,
    createdAt: raw.createdAt ?? null,
    updatedAt: raw.updatedAt ?? null,
  };
}

export function listOccurrences(executionId: string) {
  return apiRequest<OccurrenceApiResponse[]>(
    `/production-executions/${executionId}/occurrences`,
    { method: "GET" },
  ).then((res) => res.map(mapOccurrence));
}

export function createOccurrence(
  executionId: string,
  payload: FieldOccurrencePayload,
) {
  return apiRequest<OccurrenceApiResponse>(
    `/production-executions/${executionId}/occurrences`,
    { method: "POST", body: payload },
  ).then(mapOccurrence);
}

export function updateOccurrence(id: string, payload: FieldOccurrencePayload) {
  return apiRequest<OccurrenceApiResponse>(`/occurrences/${id}`, {
    method: "PUT",
    body: payload,
  }).then(mapOccurrence);
}

export function deleteOccurrence(id: string) {
  return apiRequest<void>(`/occurrences/${id}`, { method: "DELETE" });
}

/** Só `http(s)://` vira link; qualquer outro esquema (javascript:, data:) não. */
export function isSafeEvidenceUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Erros de validação por campo (parser único em `lib/api`). */
export const parseOccurrenceFieldErrors = parseFieldErrors;
