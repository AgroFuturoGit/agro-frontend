import { apiRequest } from "@/lib/api";
import type { Role } from "@/lib/auth";

export type User = {
  id: number;
  fullName: string;
  email: string;
  cpf: string;
  role: Role;
  dateOfBirth: string | null;
};

export type UserRegisterPayload = {
  fullName: string;
  email: string;
  password: string;
  cpf: string;
  dateOfBirth: string;
  role: Role;
};

export type UserUpdatePayload = {
  fullName: string;
  dateOfBirth: string;
};

export type AdminUserUpdatePayload = {
  fullName: string;
  dateOfBirth: string;
  role: Role;
};

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrador",
  MANAGER: "Gerente",
  TECHNICIAN: "Técnico",
  PRODUCER: "Produtor",
};

export const ROLES: Role[] = ["ADMIN", "MANAGER", "TECHNICIAN", "PRODUCER"];

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

export function adminUpdateUser(id: number, payload: AdminUserUpdatePayload) {
  return apiRequest<User>(`/users/${id}`, {
    method: "PATCH",
    body: payload,
  });
}

export function deleteUser(id: number) {
  return apiRequest<void>(`/users/${id}`, { method: "DELETE" });
}
