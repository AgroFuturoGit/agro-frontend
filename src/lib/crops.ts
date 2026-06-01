import { apiRequest } from "@/lib/api";

export type Crop = {
  id: string;
  name: string;
  variety: string;
  isPriority: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CropWritePayload = {
  name: string;
  variety: string;
  isPriority: boolean;
};

export type PaginatedCrops = {
  data: Crop[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type CropListParams = {
  search?: string;
  isPriority?: boolean;
  page?: number;
  limit?: number;
};

type CropApiResponse = {
  id: string;
  name: string;
  variety: string;
  is_priority: boolean;
  created_at: string;
  updated_at: string;
};

type PaginatedCropsApiResponse = {
  data: CropApiResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
};

type CropWriteApiPayload = {
  name: string;
  variety: string;
  is_priority: boolean;
};

function mapCrop(raw: CropApiResponse): Crop {
  return {
    id: raw.id,
    name: raw.name,
    variety: raw.variety,
    isPriority: raw.is_priority,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

function mapWritePayload(payload: CropWritePayload): CropWriteApiPayload {
  return {
    name: payload.name,
    variety: payload.variety,
    is_priority: payload.isPriority,
  };
}

function buildListQuery(params?: CropListParams): string {
  const searchParams = new URLSearchParams();
  if (params?.search?.trim()) {
    searchParams.set("search", params.search.trim());
  }
  if (params?.isPriority === true) {
    searchParams.set("is_priority", "true");
  }
  if (params?.page !== undefined) {
    searchParams.set("page", String(params.page));
  }
  if (params?.limit !== undefined) {
    searchParams.set("limit", String(params.limit));
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export function listCrops(params?: CropListParams) {
  return apiRequest<PaginatedCropsApiResponse>(
    `/crops${buildListQuery(params)}`,
    { method: "GET" },
  ).then((response) => ({
    data: response.data.map(mapCrop),
    meta: {
      page: response.meta.page,
      limit: response.meta.limit,
      total: response.meta.total,
      totalPages: response.meta.total_pages,
    },
  }));
}

export function getCrop(id: string) {
  return apiRequest<CropApiResponse>(`/crops/${id}`, { method: "GET" }).then(
    mapCrop,
  );
}

export function createCrop(payload: CropWritePayload) {
  return apiRequest<CropApiResponse>("/crops", {
    method: "POST",
    body: mapWritePayload(payload),
  }).then(mapCrop);
}

export function updateCrop(id: string, payload: CropWritePayload) {
  return apiRequest<CropApiResponse>(`/crops/${id}`, {
    method: "PATCH",
    body: mapWritePayload(payload),
  }).then(mapCrop);
}

/**
 * Planned CropSelect props (UC03 — planejamento de safra):
 * value: string; onChange: (id: string) => void; filterPriority?: boolean
 */
export function parseCropFieldErrors(payload: unknown): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!payload || typeof payload !== "object") return errors;

  const record = payload as Record<string, unknown>;

  if (Array.isArray(record.errors)) {
    for (const item of record.errors) {
      if (
        item &&
        typeof item === "object" &&
        "field" in item &&
        "message" in item
      ) {
        const field = String((item as { field: unknown }).field);
        const message = String((item as { message: unknown }).message);
        errors[field] = message;
      }
    }
  }

  const message =
    typeof record.message === "string" ? record.message : undefined;

  if (Array.isArray(record.fields) && message) {
    for (const field of record.fields) {
      errors[String(field)] = message;
    }
  }

  return errors;
}
