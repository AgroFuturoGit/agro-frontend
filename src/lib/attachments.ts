import { apiDownload, apiRequest, apiUpload } from "@/lib/api";

export const ATTACHMENT_MAX_COUNT = 5;
export const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
export const ATTACHMENT_ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
/** Valor do atributo `accept` do seletor de arquivos. */
export const ATTACHMENT_ACCEPT = ATTACHMENT_ACCEPTED_TYPES.join(",");

export const ATTACHMENT_MESSAGES = {
  format: "Formato não aceito. Envie a imagem como JPEG, PNG ou WebP.",
  empty: "O arquivo enviado está vazio.",
  size: "A imagem excede o limite de 5 MB.",
  limit: "Este apontamento já tem 5 anexos, que é o máximo permitido.",
} as const;

export type ExecutionAttachment = {
  id: string;
  executionId: string;
  clientId: string | null;
  filename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string | null;
};

type AttachmentApiResponse = {
  id: string;
  productionExecutionId?: string | null;
  clientId?: string | null;
  filename?: string | null;
  contentType?: string | null;
  sizeBytes?: number | null;
  url?: string | null;
  createdAt?: string | null;
};

export function mapAttachment(
  raw: AttachmentApiResponse,
  executionId: string,
): ExecutionAttachment {
  return {
    id: raw.id,
    executionId: raw.productionExecutionId ?? executionId,
    clientId: raw.clientId ?? null,
    filename: raw.filename || "foto",
    contentType: raw.contentType ?? "",
    sizeBytes: raw.sizeBytes ?? 0,
    createdAt: raw.createdAt ?? null,
  };
}

function basePath(executionId: string) {
  return `/production-executions/${encodeURIComponent(executionId)}/attachments`;
}

export function listAttachments(executionId: string) {
  return apiRequest<AttachmentApiResponse[]>(basePath(executionId), {
    method: "GET",
  }).then((res) => (Array.isArray(res) ? res : []).map((r) => mapAttachment(r, executionId)));
}

// Cada arquivo escolhido ganha um `clientId` que dura até a resposta: o mesmo
// arquivo reenviado após uma falha reusa o id e o back devolve o anexo já gravado.
const clientIds = new WeakMap<File, string>();

export function clientIdFor(file: File): string {
  let id = clientIds.get(file);
  if (!id) {
    id = crypto.randomUUID();
    clientIds.set(file, id);
  }
  return id;
}

export function forgetClientId(file: File): void {
  clientIds.delete(file);
}

/** Envia uma imagem (parte `file`) com o `clientId` do arquivo; reenvio reusa o id. */
export function uploadAttachment(executionId: string, file: File) {
  const body = new FormData();
  body.append("file", file);
  const clientId = clientIdFor(file);
  return apiUpload<AttachmentApiResponse>(
    `${basePath(executionId)}?clientId=${encodeURIComponent(clientId)}`,
    body,
  ).then((raw) => {
    forgetClientId(file);
    return mapAttachment(raw, executionId);
  });
}

/** Binário autenticado do anexo (miniatura, ampliação e download). */
export function downloadAttachment(executionId: string, attachmentId: string, filename: string) {
  return apiDownload(
    `${basePath(executionId)}/${encodeURIComponent(attachmentId)}`,
    filename,
  );
}

export function deleteAttachment(executionId: string, attachmentId: string) {
  return apiRequest<void>(
    `${basePath(executionId)}/${encodeURIComponent(attachmentId)}`,
    { method: "DELETE" },
  );
}

/**
 * Confere a foto antes de enviar, com as mesmas mensagens do back.
 * `currentCount` é quantos anexos o apontamento já tem. Devolve null se estiver ok.
 */
export function validateImageFile(file: File, currentCount: number): string | null {
  if (currentCount >= ATTACHMENT_MAX_COUNT) return ATTACHMENT_MESSAGES.limit;
  if (!(ATTACHMENT_ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
    return ATTACHMENT_MESSAGES.format;
  }
  if (file.size === 0) return ATTACHMENT_MESSAGES.empty;
  if (file.size > ATTACHMENT_MAX_BYTES) return ATTACHMENT_MESSAGES.size;
  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}
