import { clearAppCaches, clearSession, readTokenFromCookie } from "@/lib/auth";
import { loadingStore } from "@/lib/loading-store";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export class ApiError extends Error {
  status: number;
  payload: unknown;
  /** Segundos pedidos pelo back no header `Retry-After` (429); nulo sem o header. */
  retryAfterSeconds: number | null;

  constructor(
    status: number,
    message: string,
    payload: unknown,
    retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.status = status;
    this.payload = payload;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** 409 de edição simultânea: o back devolve o registro atual em `current`. */
export function isConcurrencyConflict(err: ApiError): boolean {
  const payload = err.payload;
  return (
    err.status === 409 &&
    typeof payload === "object" &&
    payload !== null &&
    "current" in payload
  );
}

/** Navegação isolada para poder ser trocada nos testes. */
export const sessionNavigator = {
  goToLogin(from: string | null) {
    const query = from ? `?from=${encodeURIComponent(from)}` : "";
    window.location.assign(`/login${query}`);
  },
};

/**
 * O back responde 401 para token ausente, inválido ou vencido e 403 só para
 * falta de permissão. No 401 a sessão acaba na hora: limpa o que ficou salvo
 * e leva ao login, guardando a rota para voltar depois.
 */
function endSession() {
  clearSession();
  void clearAppCaches();
  const { pathname, search } = window.location;
  if (pathname.startsWith("/login")) return;
  const current = `${pathname}${search}`;
  sessionNavigator.goToLogin(pathname.startsWith("/admin") ? current : null);
}

/** `Retry-After` em segundos inteiros positivos; qualquer outra coisa vira nulo. */
function parseRetryAfter(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value.trim())) return null;
  const seconds = Number(value.trim());
  return seconds > 0 ? seconds : null;
}

/**
 * Monta o `ApiError` de uma resposta com falha: lê o corpo (JSON ou texto),
 * escolhe a mensagem, encerra a sessão no 401 (exceto no login) e guarda o
 * `Retry-After`. Usado por `apiRequest` e `apiDownload`.
 */
async function toApiError(
  response: Response,
  path: string,
  auth: boolean,
): Promise<ApiError> {
  const isJson = response.headers
    .get("content-type")
    ?.includes("application/json");
  let payload: unknown = null;
  try {
    payload = isJson ? await response.json() : await response.text();
  } catch {
    // Corpo vazio ou inválido: segue com payload nulo (mensagem "Erro NNN").
  }
  const message =
    (isJson && payload && typeof payload === "object" && "message" in payload
      ? String((payload as { message: unknown }).message)
      : null) ?? `Erro ${response.status}`;
  if (auth && response.status === 401 && path !== "/auth/login") {
    endSession();
  }
  return new ApiError(
    response.status,
    message,
    payload,
    parseRetryAfter(response.headers.get("retry-after")),
  );
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  auth?: boolean;
};

export async function apiRequest<T = unknown>(
  path: string,
  { body, auth = true, headers, ...rest }: RequestOptions = {},
): Promise<T> {
  const finalHeaders = new Headers(headers);
  if (body !== undefined && !finalHeaders.has("Content-Type")) {
    finalHeaders.set("Content-Type", "application/json");
  }
  if (auth) {
    const token = readTokenFromCookie();
    if (token) finalHeaders.set("Authorization", `Bearer ${token}`);
  }

  loadingStore.start();
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers: finalHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!response.ok) throw await toApiError(response, path, auth);

    const isJson = response.headers
      .get("content-type")
      ?.includes("application/json");
    let payload: unknown = null;
    try {
      payload = isJson ? await response.json() : await response.text();
    } catch {
      throw new SyntaxError("Resposta da API inválida");
    }

    return payload as T;
  } finally {
    loadingStore.stop();
  }
}

/** Nome do arquivo no `Content-Disposition` (`filename*=UTF-8''…` ou `filename="…"`). */
export function parseContentDispositionFilename(
  header: string | null,
): string | null {
  if (!header) return null;
  const star = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/i.exec(header);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim());
    } catch {
      // Codificação inválida: tenta a forma simples.
    }
  }
  const plain = /filename\s*=\s*(?:"([^"]*)"|([^;]+))/i.exec(header);
  const name = (plain?.[1] ?? plain?.[2] ?? "").trim();
  return name || null;
}

/**
 * Defesa em profundidade: o back já sanitiza, mas o nome do header não é
 * confiável. Remove separadores de caminho, controles e `..`, limita o
 * tamanho e cai em `relatorio.<ext>` se nada sobrar.
 */
export function sanitizeFilename(name: string): string {
  const ext = /\.([A-Za-z0-9]{1,8})$/.exec(name.trim())?.[1];
  const clean = name
    .replace(/[\\/\x00-\x1f\x7f]/g, "")
    .replace(/\.{2,}/g, "")
    .trim()
    .slice(0, 150);
  if (!clean || /^\.+$/.test(clean)) {
    return ext ? `relatorio.${ext}` : "relatorio";
  }
  return clean;
}

export type DownloadResult = { blob: Blob; filename: string };

/**
 * GET autenticado que devolve um arquivo. Usa o nome do `Content-Disposition`
 * ou `fallbackName`; erros JSON viram `ApiError` e o 401 encerra a sessão
 * como em `apiRequest`.
 */
export async function apiDownload(
  path: string,
  fallbackName = "relatorio",
): Promise<DownloadResult> {
  const headers = new Headers();
  const token = readTokenFromCookie();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  loadingStore.start();
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method: "GET",
      headers,
    });

    if (!response.ok) throw await toApiError(response, path, true);

    const blob = await response.blob();
    const rawName = parseContentDispositionFilename(
      response.headers.get("content-disposition"),
    );
    const filename = rawName ? sanitizeFilename(rawName) : fallbackName;
    return { blob, filename };
  } finally {
    loadingStore.stop();
  }
}

/**
 * POST multipart autenticado. Não define `Content-Type`: o navegador monta o
 * boundary. Erros seguem `apiRequest` (`toApiError`, 401 encerra a sessão); o
 * 413 do limite multipart vira a mensagem de 5 MB. Devolve o JSON da resposta.
 */
export async function apiUpload<T = unknown>(
  path: string,
  formData: FormData,
): Promise<T> {
  const headers = new Headers();
  const token = readTokenFromCookie();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  loadingStore.start();
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await toApiError(response, path, true);
      if (response.status === 413) {
        throw new ApiError(
          413,
          "A imagem excede o limite de 5 MB.",
          error.payload,
          error.retryAfterSeconds,
        );
      }
      throw error;
    }

    const isJson = response.headers
      .get("content-type")
      ?.includes("application/json");
    try {
      return (isJson ? await response.json() : null) as T;
    } catch {
      throw new SyntaxError("Resposta da API inválida");
    }
  } finally {
    loadingStore.stop();
  }
}

/** Backend devolve erros de validação como "campo: mensagem; campo: mensagem". */
export function parseFieldErrors(payload: unknown): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!payload || typeof payload !== "object") return errors;
  const message = (payload as Record<string, unknown>).message;
  if (typeof message !== "string") return errors;
  for (const part of message.split(";")) {
    const colonIdx = part.indexOf(":");
    if (colonIdx === -1) continue;
    const field = part.slice(0, colonIdx).trim();
    const msg = part.slice(colonIdx + 1).trim();
    if (field && msg) errors[field] = msg;
  }
  return errors;
}
