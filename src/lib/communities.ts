import { apiRequest } from "@/lib/api";
import {
  mapOrganization,
  type Organization,
  type OrganizationApiResponse,
} from "@/lib/organizations";
import {
  mapProducer,
  type Producer,
  type ProducerApiResponse,
} from "@/lib/producers";

export type Community = {
  id: string;
  name: string;
  organization: Organization;
};

export type CommunityApiResponse = {
  id: string;
  name: string;
  organization: OrganizationApiResponse;
};

export type CommunityPayload = {
  name: string;
};

/** `FarmerRegisterDTO`: só `fullName` e `cpf` são obrigatórios no back. */
export type ProducerRegisterPayload = {
  fullName: string;
  cpf: string;
  email?: string;
  password?: string;
  dateOfBirth?: string;
  motherName?: string;
  origin?: string;
  educationLevel?: string;
  phone?: string;
  localName?: string;
  street?: string;
  city?: string;
  state?: string;
  ibgeCode?: string;
  latitude?: number;
  longitude?: number;
};

export function mapCommunity(raw: CommunityApiResponse): Community {
  return {
    id: raw.id,
    name: raw.name,
    organization: mapOrganization(raw.organization),
  };
}

/**
 * Lista comunidades. `organizationId` é opcional — quando informado, vira
 * o filtro `?orgId=`. O backend não restringe MANAGER à própria
 * organização, então o filtro precisa ser sempre explícito pelo chamador.
 */
export function listCommunities(
  organizationId?: string,
): Promise<Community[]> {
  const query = organizationId
    ? `?orgId=${encodeURIComponent(organizationId)}`
    : "";
  return apiRequest<CommunityApiResponse[]>(`/communities${query}`, {
    method: "GET",
  }).then((list) => list.map(mapCommunity));
}

export function getCommunity(id: string): Promise<Community> {
  return apiRequest<CommunityApiResponse>(`/communities/${id}`, {
    method: "GET",
  }).then(mapCommunity);
}

/**
 * Cria uma Comunidade dentro de uma Organização.
 * `organizationId` é path param — nunca faz parte do corpo da requisição.
 */
export function createCommunity(
  organizationId: string,
  payload: CommunityPayload,
): Promise<Community> {
  return apiRequest<CommunityApiResponse>(
    `/organizations/${organizationId}/communities`,
    {
      method: "POST",
      body: payload,
    },
  ).then(mapCommunity);
}

export function updateCommunity(
  id: string,
  payload: CommunityPayload,
): Promise<Community> {
  return apiRequest<CommunityApiResponse>(`/communities/${id}`, {
    method: "PUT",
    body: payload,
  }).then(mapCommunity);
}

export function deleteCommunity(id: string): Promise<void> {
  return apiRequest<void>(`/communities/${id}`, { method: "DELETE" });
}

/**
 * Registra um Producer vinculado a uma Comunidade.
 * Fluxo hierárquico obrigatório — `POST /users/register` rejeita
 * `role: "FARMER"` com 400.
 */
export function registerProducer(
  communityId: string,
  payload: ProducerRegisterPayload,
): Promise<Producer> {
  return apiRequest<ProducerApiResponse>(
    `/communities/${communityId}/farmers`,
    {
      method: "POST",
      body: payload,
    },
  ).then(mapProducer);
}

// Backend retorna erros de validação como: "name: msg"
export function parseCommunityFieldErrors(
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
export function parseProducerRegisterFieldErrors(
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
