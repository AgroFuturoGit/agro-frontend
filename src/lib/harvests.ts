import { apiRequest } from "@/lib/api";

export type Harvest = {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
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
};

function mapHarvest(raw: HarvestApiResponse): Harvest {
  return {
    id: raw.id,
    label: raw.label,
    startDate: raw.startDate,
    endDate: raw.endDate,
  };
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

export function updateHarvest(id: string, payload: HarvestWritePayload) {
  return apiRequest<HarvestApiResponse>(`/harvests/${id}`, {
    method: "PATCH",
    body: payload,
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
