import { apiRequest } from "@/lib/api";

export type Harvest = {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  createdAt?: string;
  updatedAt?: string;
};

export type HarvestWritePayload = {
  label: string;
  startDate: string;
  endDate: string;
};

type HarvestApiResponse = {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export function mapHarvest(raw: HarvestApiResponse): Harvest {
  return {
    id: raw.id,
    label: raw.label,
    startDate: raw.startDate,
    endDate: raw.endDate,
    ...(raw.createdAt ? { createdAt: raw.createdAt } : {}),
    ...(raw.updatedAt ? { updatedAt: raw.updatedAt } : {}),
  };
}

/**
 * Versão do registro que a tela tem: `updatedAt`, ou `createdAt` quando a
 * safra nunca foi editada. A string segue exatamente como o back mandou.
 */
export function harvestVersion(
  harvest: Pick<Harvest, "updatedAt" | "createdAt"> | null | undefined,
): string | undefined {
  return harvest?.updatedAt ?? harvest?.createdAt ?? undefined;
}

export function listHarvests() {
  return apiRequest<HarvestApiResponse[]>("/harvests", { method: "GET" }).then(
    (response) => response.map(mapHarvest),
  );
}

export function getHarvest(id: string) {
  return apiRequest<HarvestApiResponse>(`/harvests/${id}`, {
    method: "GET",
  }).then(mapHarvest);
}

export function createHarvest(payload: HarvestWritePayload) {
  return apiRequest<HarvestApiResponse>("/harvests/register", {
    method: "POST",
    body: payload,
  }).then(mapHarvest);
}

/**
 * `baseUpdatedAt` é a versão que o usuário viu ao abrir a edição: o back
 * recusa com 409 se a safra mudou depois disso.
 */
export function updateHarvest(
  id: string,
  payload: HarvestWritePayload,
  baseUpdatedAt?: string,
) {
  return apiRequest<HarvestApiResponse>(`/harvests/${id}`, {
    method: "PATCH",
    body: baseUpdatedAt ? { ...payload, baseUpdatedAt } : payload,
  }).then(mapHarvest);
}

export function deleteHarvest(id: string) {
  return apiRequest<void>(`/harvests/${id}`, { method: "DELETE" });
}

export function formatHarvestDate(value: string | null | undefined): string {
  if (!value) return "—";
  // Backend retorna LocalDate "yyyy-MM-dd"; evita shift de timezone.
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (match) {
    const [, year, month, day] = match;
    return `${day}/${month}/${year}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR");
}
