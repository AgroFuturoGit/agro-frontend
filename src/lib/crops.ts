import { apiRequest } from "@/lib/api";

export type Crop = {
  id: string;
  name: string;
  variety: string;
  isPriority: boolean;
  updatedAt?: string;
};

export type CropWritePayload = {
  name: string;
  variety: string;
  isPriority: boolean;
};

export type CropListParams = {
  search?: string;
  isPriority?: boolean;
};

type CropApiResponse = {
  id: string;
  name: string;
  variety: string;
  isPriority: boolean;
};

function mapCrop(raw: CropApiResponse): Crop {
  return {
    id: raw.id,
    name: raw.name,
    variety: raw.variety,
    isPriority: raw.isPriority,
  };
}

export async function listCrops(params?: CropListParams): Promise<Crop[]> {
  const all = await apiRequest<CropApiResponse[]>("/crops", {
    method: "GET",
  }).then((res) => res.map(mapCrop));

  let result = all;

  if (params?.search) {
    const q = params.search.toLowerCase();
    result = result.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.variety.toLowerCase().includes(q),
    );
  }

  if (params?.isPriority) {
    result = result.filter((c) => c.isPriority);
  }

  return result;
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
