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

    const isJson = response.headers
      .get("content-type")
      ?.includes("application/json");
    let payload: unknown = null;
    try {
      payload = isJson ? await response.json() : await response.text();
    } catch {
      // Corpo vazio ou inválido: segue com payload nulo (mensagem "Erro NNN").
      if (response.ok) throw new SyntaxError("Resposta da API inválida");
    }

    if (!response.ok) {
      const message =
        (isJson &&
        payload &&
        typeof payload === "object" &&
        "message" in payload
          ? String((payload as { message: unknown }).message)
          : null) ?? `Erro ${response.status}`;
      if (auth && response.status === 401 && path !== "/auth/login") {
        endSession();
      }
      throw new ApiError(
        response.status,
        message,
        payload,
        parseRetryAfter(response.headers.get("retry-after")),
      );
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

    if (!response.ok) {
      const isJson = response.headers
        .get("content-type")
        ?.includes("application/json");
      let payload: unknown = null;
      try {
        payload = isJson ? await response.json() : await response.text();
      } catch {
        // Corpo vazio ou inválido: mensagem genérica "Erro NNN".
      }
      const message =
        (isJson && payload && typeof payload === "object" && "message" in payload
          ? String((payload as { message: unknown }).message)
          : null) ?? `Erro ${response.status}`;
      if (response.status === 401) endSession();
      throw new ApiError(
        response.status,
        message,
        payload,
        parseRetryAfter(response.headers.get("retry-after")),
      );
    }

    const blob = await response.blob();
    const filename =
      parseContentDispositionFilename(
        response.headers.get("content-disposition"),
      ) ?? fallbackName;
    return { blob, filename };
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
