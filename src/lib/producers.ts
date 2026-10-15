import { apiRequest } from "@/lib/api";
import type { Organization, OrganizationApiResponse } from "@/lib/organizations";

export type RegistrationSource = "SELF" | "TECHNICIAN" | "MANAGER";

type ProducerFields = {
  id: string;
  /** Nome do próprio agricultor (`FarmerResponseDTO.fullName`). */
  fullName: string | null;
  cpf: string | null;
  /** Data ISO `yyyy-MM-dd`. */
  dateOfBirth: string | null;
  motherName: string | null;
  origin: string | null;
  educationLevel: string | null;
  phone: string | null;
  /** Endereço/Nome local (padrão IBGE). */
  localName: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  ibgeCode: string | null;
  latitude: number | null;
  longitude: number | null;
  isCompliant: boolean | null;
  registrationSource: RegistrationSource | null;
  createdAt: string | null;
  updatedAt: string | null;
  user: {
    id: string;
    fullName: string;
    email: string;
    cpf: string;
  } | null;
};

export type Producer = ProducerFields & {
  community: {
    id: string;
    name: string;
    /**
     * `GET /farmers/me` (e `GET /farmers`/`GET /farmers/{id}`) já
     * devolve o `CommunityResponseDTO` completo, com a organização aninhada
     * (ver `FarmerResponseDTO.java`). Mapear esse campo evita ter que
     * chamar `GET /communities/{id}` (proibido para FARMER,
     * `hasRole('MANAGER') or hasRole('ADMIN')` em `CommunityController`) só
     * para resolver o nome da organização na navegação em cascata.
     */
    organization: Organization | null;
  } | null;
};

/** Resposta do back (`FarmerResponseDTO`); campos novos podem faltar. */
export type ProducerApiResponse = Partial<
  Omit<ProducerFields, "id" | "user">
> & {
  id: string;
  user?: ProducerFields["user"];
  community?: {
    id: string;
    name: string;
    organization?: OrganizationApiResponse | null;
  } | null;
};

/** BR-001: nome do agricultor, senão o do usuário, senão "Agricultor". */
export function producerDisplayName(
  producer:
    | {
        fullName?: string | null;
        user?: { fullName?: string | null } | null;
      }
    | null
    | undefined,
  fallback = "Agricultor",
): string {
  return (
    producer?.fullName?.trim() || producer?.user?.fullName?.trim() || fallback
  );
}

/** Valida CPF pelos dígitos verificadores (aceita máscara). */
export function isValidCpf(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  for (const length of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < length; i++) {
      sum += Number(digits[i]) * (length + 1 - i);
    }
    const check = ((sum * 10) % 11) % 10;
    if (check !== Number(digits[length])) return false;
  }
  return true;
}

export function mapProducer(raw: ProducerApiResponse): Producer {
  return {
    id: raw.id,
    fullName: raw.fullName ?? null,
    cpf: raw.cpf ?? null,
    dateOfBirth: raw.dateOfBirth ?? null,
    motherName: raw.motherName ?? null,
    origin: raw.origin ?? null,
    educationLevel: raw.educationLevel ?? null,
    phone: raw.phone ?? null,
    localName: raw.localName ?? null,
    street: raw.street ?? null,
    city: raw.city ?? null,
    state: raw.state ?? null,
    ibgeCode: raw.ibgeCode ?? null,
    latitude: raw.latitude ?? null,
    longitude: raw.longitude ?? null,
    isCompliant: raw.isCompliant ?? null,
    registrationSource: raw.registrationSource ?? null,
    createdAt: raw.createdAt ?? null,
    updatedAt: raw.updatedAt ?? null,
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

/**
 * `FarmerUpdateDTO` (`PUT /farmers/{id}`). CPF não é editável e `null`
 * significa "manter" no back; texto esvaziado vai como `""` (limpa).
 */
export type ProducerUpdatePayload = {
  fullName?: string | null;
  dateOfBirth?: string | null;
  motherName?: string | null;
  origin?: string | null;
  educationLevel?: string | null;
  phone?: string | null;
  localName?: string | null;
  street?: string | null;
  city?: string | null;
  state?: string | null;
  ibgeCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isCompliant?: boolean | null;
};

/** Dados do produtor vinculado ao usuário autenticado. */
export function getMyProducer() {
  return apiRequest<ProducerApiResponse>("/farmers/me", {
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
  return apiRequest<ProducerApiResponse[]>(`/farmers${query}`, {
    method: "GET",
  }).then((list) => list.map(mapProducer));
}

export function updateProducer(id: string, payload: ProducerUpdatePayload) {
  return apiRequest<ProducerApiResponse>(`/farmers/${id}`, {
    method: "PUT",
    body: payload,
  }).then(mapProducer);
}

export function deleteProducer(id: string) {
  return apiRequest<void>(`/farmers/${id}`, { method: "DELETE" });
}
