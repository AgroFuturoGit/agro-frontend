import { apiRequest } from "@/lib/api";
import type { Organization, OrganizationApiResponse } from "@/lib/organizations";

export type Producer = {
  id: string;
  aliasName: string | null;
  isCompliant: boolean | null;
  user: {
    id: string;
    fullName: string;
    email: string;
    cpf: string;
  } | null;
  community: {
    id: string;
    name: string;
    /**
     * `GET /producers/me` (e `GET /producers`/`GET /producers/{id}`) já
     * devolve o `CommunityResponseDTO` completo, com a organização aninhada
     * (ver `ProducerResponseDTO.java`). Mapear esse campo evita ter que
     * chamar `GET /communities/{id}` (proibido para PRODUCER,
     * `hasRole('MANAGER') or hasRole('ADMIN')` em `CommunityController`) só
     * para resolver o nome da organização na navegação em cascata.
     */
    organization: Organization | null;
  } | null;
};

type ProducerApiResponse = {
  id: string;
  aliasName: string | null;
  isCompliant: boolean | null;
  user: {
    id: string;
    fullName: string;
    email: string;
    cpf: string;
  } | null;
  community: {
    id: string;
    name: string;
    organization: OrganizationApiResponse | null;
  } | null;
};

function mapProducer(raw: ProducerApiResponse): Producer {
  return {
    id: raw.id,
    aliasName: raw.aliasName ?? null,
    isCompliant: raw.isCompliant ?? null,
    user: raw.user
      ? {
          id: raw.user.id,
          fullName: raw.user.fullName,
          email: raw.user.email,
          cpf: raw.user.cpf,
        }
      : null,
    community: raw.community
      ? {
          id: raw.community.id,
          name: raw.community.name,
          organization: raw.community.organization
            ? {
                id: raw.community.organization.id,
                name: raw.community.organization.name,
                taxId: raw.community.organization.taxId,
                type: raw.community.organization.type,
              }
            : null,
        }
      : null,
  };
}

export type ProducerUpdatePayload = {
  aliasName: string | null;
  isCompliant: boolean | null;
};

/** Dados do produtor vinculado ao usuário autenticado. */
export function getMyProducer() {
  return apiRequest<ProducerApiResponse>("/producers/me", {
    method: "GET",
  }).then(mapProducer);
}

/**
 * Lista todos os produtores (ADMIN/MANAGER). Opcionalmente filtra por
 * comunidade.
 */
export function listProducers(communityId?: string) {
  const query = communityId
    ? `?communityId=${encodeURIComponent(communityId)}`
    : "";
  return apiRequest<ProducerApiResponse[]>(`/producers${query}`, {
    method: "GET",
  }).then((list) => list.map(mapProducer));
}

export function updateProducer(id: string, payload: ProducerUpdatePayload) {
  return apiRequest<ProducerApiResponse>(`/producers/${id}`, {
    method: "PUT",
    body: payload,
  }).then(mapProducer);
}

export function deleteProducer(id: string) {
  return apiRequest<void>(`/producers/${id}`, { method: "DELETE" });
}
