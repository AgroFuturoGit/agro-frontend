import { apiRequest } from "@/lib/api";
import {
  mapManager,
  type Manager,
  type ManagerApiResponse,
} from "@/lib/managers";

export type OrganizationType = "COOP" | "ASSOC";

export type Organization = {
  id: string;
  name: string;
  taxId: string;
  type: OrganizationType;
};

export type OrganizationApiResponse = {
  id: string;
  name: string;
  taxId: string;
  type: OrganizationType;
};

export type OrganizationPayload = {
  name: string;
  taxId: string;
  type: OrganizationType;
};

export type ManagerRegisterPayload = {
  fullName: string;
  email: string;
  password: string;
  cpf: string;
  dateOfBirth: string;
};

export const ORGANIZATION_TYPE_LABELS: Record<OrganizationType, string> = {
  COOP: "Cooperativa",
  ASSOC: "Associação",
};

export function mapOrganization(raw: OrganizationApiResponse): Organization {
  return {
    id: raw.id,
    name: raw.name,
    taxId: raw.taxId,
    type: raw.type,
  };
}

export function listOrganizations(): Promise<Organization[]> {
  return apiRequest<OrganizationApiResponse[]>("/organizations", {
    method: "GET",
  }).then((list) => list.map(mapOrganization));
}

export function getOrganization(id: string): Promise<Organization> {
  return apiRequest<OrganizationApiResponse>(`/organizations/${id}`, {
    method: "GET",
  }).then(mapOrganization);
}

export function createOrganization(
  payload: OrganizationPayload,
): Promise<Organization> {
  return apiRequest<OrganizationApiResponse>("/organizations", {
    method: "POST",
    body: payload,
  }).then(mapOrganization);
}

export function updateOrganization(
  id: string,
  payload: OrganizationPayload,
): Promise<Organization> {
  return apiRequest<OrganizationApiResponse>(`/organizations/${id}`, {
    method: "PUT",
    body: payload,
  }).then(mapOrganization);
}

export function deleteOrganization(id: string): Promise<void> {
  return apiRequest<void>(`/organizations/${id}`, { method: "DELETE" });
}

/**
 * Registra um Manager vinculado a uma Organização.
 * Fluxo hierárquico obrigatório — `POST /users/register` rejeita
 * `role: "MANAGER"` com 400.
 */
export function registerManager(
  organizationId: string,
  payload: ManagerRegisterPayload,
): Promise<Manager> {
  return apiRequest<ManagerApiResponse>(
    `/organizations/${organizationId}/managers`,
    {
      method: "POST",
      body: payload,
    },
  ).then(mapManager);
}

// Backend retorna erros de validação como: "name: msg; taxId: msg"
export function parseOrganizationFieldErrors(
  payload: unknown,
): Record<string, string> {
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

// Backend retorna erros de validação como: "email: msg; password: msg"
export function parseManagerRegisterFieldErrors(
  payload: unknown,
): Record<string, string> {
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
