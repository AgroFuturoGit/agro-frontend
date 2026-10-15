import { apiRequest } from "@/lib/api";
import type { User } from "@/lib/users";
import { mapProducer, type Producer, type ProducerApiResponse } from "@/lib/producers";

/**
 * Produtores atribuídos ao TECHNICIAN autenticado (relação N:N
 * `TechnicalAssistance`, ver `issues-fix-back.pdf` itens 7/8). O DTO é o
 * mesmo `ProducerResponseDTO` de `GET /farmers/me`, com a comunidade (e a
 * organização aninhada) inclusas — por isso reaproveita `mapProducer`.
 */
export function getMyAssignedProducers() {
  return apiRequest<ProducerApiResponse[]>("/technicians/me/farmers", {
    method: "GET",
  }).then((list) => list.map(mapProducer));
}

export const TECHNICIAN_REGISTRATION_TYPES = ["CREA", "CFT", "CFTA"] as const;

export type TechnicianRegistrationType =
  (typeof TECHNICIAN_REGISTRATION_TYPES)[number];

/** `TechnicianRegisterDTO`: tipo e número do registro são opcionais. */
export type TechnicianRegisterPayload = {
  fullName: string;
  email: string;
  password: string;
  cpf: string;
  registrationType?: TechnicianRegistrationType;
  registrationNumber?: string;
  specialty?: string;
};

export type Technician = {
  id: string;
  user: User | null;
  registrationType: TechnicianRegistrationType | null;
  registrationNumber: string | null;
  specialty: string | null;
};

/**
 * Cria o usuário **e** o perfil de técnico (ADMIN). A rota genérica
 * `POST /users/register` com `role: TECHNICIAN` cria só o usuário, que
 * depois recebe 404 em `GET /technicians/me`.
 */
export function createTechnician(payload: TechnicianRegisterPayload) {
  return apiRequest<Technician>("/technicians", {
    method: "POST",
    body: payload,
  });
}

export type { Producer };
