import { apiRequest, parseFieldErrors } from "@/lib/api";

// ----- Composição familiar -----

export type FamilyMember = {
  id: string;
  farmerId: string;
  name: string;
  kinship: string;
  age: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type FamilyMemberPayload = {
  name: string;
  kinship: string;
  age: number;
};

type FamilyMemberApiResponse = {
  id: string;
  farmerId: string;
  name?: string | null;
  kinship?: string | null;
  age?: number | string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

// ----- Financiamentos -----

export type FinancingStatus =
  | "PENDING"
  | "IN_ANALYSIS"
  | "APPROVED"
  | "REJECTED"
  | "CANCELED"
  | "PAID";

export const FINANCING_STATUSES: FinancingStatus[] = [
  "PENDING",
  "IN_ANALYSIS",
  "APPROVED",
  "REJECTED",
  "CANCELED",
  "PAID",
];

export const FINANCING_STATUS_LABELS: Record<FinancingStatus, string> = {
  PENDING: "Pendente",
  IN_ANALYSIS: "Em análise",
  APPROVED: "Aprovado",
  REJECTED: "Rejeitado",
  CANCELED: "Cancelado",
  PAID: "Quitado",
};

export type Financing = {
  id: string;
  farmerId: string;
  description: string;
  status: FinancingStatus | null;
  amount: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type FinancingPayload = {
  description: string;
  status: FinancingStatus;
  amount: number;
};

type FinancingApiResponse = {
  id: string;
  farmerId: string;
  description?: string | null;
  status?: string | null;
  amount?: number | string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function mapFamilyMember(raw: FamilyMemberApiResponse): FamilyMember {
  return {
    id: raw.id,
    farmerId: raw.farmerId,
    name: raw.name ?? "",
    kinship: raw.kinship ?? "",
    age: toNumber(raw.age),
    createdAt: raw.createdAt ?? null,
    updatedAt: raw.updatedAt ?? null,
  };
}

export function parseFinancingStatus(value: unknown): FinancingStatus | null {
  return FINANCING_STATUSES.includes(value as FinancingStatus)
    ? (value as FinancingStatus)
    : null;
}

export function mapFinancing(raw: FinancingApiResponse): Financing {
  return {
    id: raw.id,
    farmerId: raw.farmerId,
    description: raw.description ?? "",
    status: parseFinancingStatus(raw.status),
    amount: toNumber(raw.amount),
    createdAt: raw.createdAt ?? null,
    updatedAt: raw.updatedAt ?? null,
  };
}

// ----- Chamadas: composição familiar -----

export function listFamilyMembers(farmerId: string) {
  return apiRequest<FamilyMemberApiResponse[]>(
    `/farmers/${farmerId}/family-compositions`,
    { method: "GET" },
  ).then((res) => res.map(mapFamilyMember));
}

export function createFamilyMember(
  farmerId: string,
  payload: FamilyMemberPayload,
) {
  return apiRequest<FamilyMemberApiResponse>(
    `/farmers/${farmerId}/family-compositions`,
    { method: "POST", body: payload },
  ).then(mapFamilyMember);
}

export function updateFamilyMember(id: string, payload: FamilyMemberPayload) {
  return apiRequest<FamilyMemberApiResponse>(`/family-compositions/${id}`, {
    method: "PUT",
    body: payload,
  }).then(mapFamilyMember);
}

export function deleteFamilyMember(id: string) {
  return apiRequest<void>(`/family-compositions/${id}`, { method: "DELETE" });
}

// ----- Chamadas: financiamentos -----

export function listFinancings(farmerId: string) {
  return apiRequest<FinancingApiResponse[]>(
    `/farmers/${farmerId}/financings`,
    { method: "GET" },
  ).then((res) => res.map(mapFinancing));
}

export function createFinancing(farmerId: string, payload: FinancingPayload) {
  return apiRequest<FinancingApiResponse>(`/farmers/${farmerId}/financings`, {
    method: "POST",
    body: payload,
  }).then(mapFinancing);
}

export function updateFinancing(id: string, payload: FinancingPayload) {
  return apiRequest<FinancingApiResponse>(`/financings/${id}`, {
    method: "PUT",
    body: payload,
  }).then(mapFinancing);
}

export function deleteFinancing(id: string) {
  return apiRequest<void>(`/financings/${id}`, { method: "DELETE" });
}

// ----- Formatadores e parsers -----

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatCurrency(value: number): string {
  return BRL.format(value);
}

/**
 * Converte o texto digitado em reais no padrão brasileiro (ponto é milhar,
 * vírgula é decimal): "1.234" -> 1234, "1.234,56" -> 1234.56, "12,5" -> 12.5.
 * Devolve `null` quando a entrada é inválida ou ambígua (ex.: "12.5").
 */
export function parseAmountInput(text: string): number | null {
  const raw = text.trim().replace(/^R\$\s*/, "");
  if (!raw) return null;
  const [intPart, decPart, ...rest] = raw.split(",");
  if (rest.length > 0) return null;
  if (!/^(\d+|\d{1,3}(\.\d{3})+)$/.test(intPart)) return null;
  if (decPart !== undefined && !/^\d+$/.test(decPart)) return null;
  const value = Number(`${intPart.replace(/\./g, "")}${decPart ? `.${decPart}` : ""}`);
  return Number.isFinite(value) ? value : null;
}

/** Erros de validação por campo (parser único em `lib/api`). */
export const parseSocialFieldErrors = parseFieldErrors;
