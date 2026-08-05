import { apiRequest } from "@/lib/api";
import type { Role } from "@/lib/auth";
import type { Organization } from "@/lib/organizations";

export type Manager = {
  id: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    cpf: string;
    role: Role;
    dateOfBirth: string | null;
  };
  organization: Organization;
};

export type ManagerApiResponse = {
  id: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    cpf: string;
    role: Role;
    dateOfBirth: string | null;
  };
  organization: {
    id: string;
    name: string;
    taxId: string;
    type: Organization["type"];
  };
};

export function mapManager(raw: ManagerApiResponse): Manager {
  return {
    id: raw.id,
    user: {
      id: raw.user.id,
      fullName: raw.user.fullName,
      email: raw.user.email,
      cpf: raw.user.cpf,
      role: raw.user.role,
      dateOfBirth: raw.user.dateOfBirth ?? null,
    },
    organization: {
      id: raw.organization.id,
      name: raw.organization.name,
      taxId: raw.organization.taxId,
      type: raw.organization.type,
    },
  };
}

/** Dados do Manager vinculado ao usuário autenticado (role MANAGER). */
export function getMyManager(): Promise<Manager> {
  return apiRequest<ManagerApiResponse>("/managers/me", {
    method: "GET",
  }).then(mapManager);
}
