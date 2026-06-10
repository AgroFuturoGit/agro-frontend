import { apiRequest } from "@/lib/api";
import type { Role } from "@/lib/auth";

export type BackendRole = {
  name: Role;
  description: string;
};

export function listRoles() {
  return apiRequest<BackendRole[]>("/roles", { method: "GET" });
}
