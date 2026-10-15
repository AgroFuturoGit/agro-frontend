import { apiRequest } from "@/lib/api";
import type { Role } from "@/lib/auth";

export type User = {
  id: string;
  fullName: string;
  email: string;
  /** Opcional no back (`UserRegisterDTO`): usuários sem CPF vêm `null`. */
  cpf: string | null;
  role: Role;
};

export type UserRegisterPayload = {
  fullName: string;
  email: string;
  password: string;
  /** Opcional no `UserRegisterDTO`. */
  cpf?: string;
  role: Role;
};

export type UserUpdatePayload = {
  fullName: string;
};

export type AdminUserUpdatePayload = {
  fullName: string;
  role: Role;
};

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrador",
  MANAGER: "Gerente",
  TECHNICIAN: "Técnico",
  FARMER: "Agricultor",
};

export const ROLES: Role[] = ["ADMIN", "MANAGER", "TECHNICIAN", "FARMER"];

/**
 * Perfis criáveis na tela de Usuários. ADMIN nasce por `POST /users/register`;
 * TECHNICIAN por `POST /technicians` (cria também o perfil de técnico).
 * MANAGER e FARMER nascem pelos fluxos da hierarquia (Organização e
 * Comunidade) — o backend rejeita a criação genérica desses perfis (400).
 */
export const CREATABLE_ROLES: Role[] = ["ADMIN", "TECHNICIAN"];

export function listUsers() {
  return apiRequest<User[]>("/users", { method: "GET" });
}

export function registerUser(payload: UserRegisterPayload) {
  return apiRequest<User>("/users/register", {
    method: "POST",
    body: payload,
  });
}

export function updateCurrentUser(payload: UserUpdatePayload) {
  return apiRequest<User>("/users", {
    method: "PATCH",
    body: payload,
  });
}

export function adminUpdateUser(id: string, payload: AdminUserUpdatePayload) {
  return apiRequest<User>(`/users/${id}`, {
    method: "PATCH",
    body: payload,
  });
}

export function deleteUser(id: string) {
  return apiRequest<void>(`/users/${id}`, { method: "DELETE" });
}
