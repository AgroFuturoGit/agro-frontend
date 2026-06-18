import { apiRequest } from "@/lib/api";

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
      ? { id: raw.community.id, name: raw.community.name }
      : null,
  };
}

/** Dados do produtor vinculado ao usuário autenticado. */
export function getMyProducer() {
  return apiRequest<ProducerApiResponse>("/producers/me", {
    method: "GET",
  }).then(mapProducer);
}
