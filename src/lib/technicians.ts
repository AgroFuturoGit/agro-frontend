import { apiRequest } from "@/lib/api";
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

export type { Producer };
