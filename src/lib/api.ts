import { clearAppCaches, clearSession, readTokenFromCookie } from "@/lib/auth";
import { loadingStore } from "@/lib/loading-store";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(status: number, message: string, payload: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

/** Navegação isolada para poder ser trocada nos testes. */
export const sessionNavigator = {
  goToLogin(from: string | null) {
    const query = from ? `?from=${encodeURIComponent(from)}` : "";
    window.location.assign(`/login${query}`);
  },
};

let sessionCheck: Promise<void> | null = null;

/**
 * O back responde 401, 403 ou 500 para token inválido, e 403 também para
 * permissão negada com token válido — o status sozinho não diz qual é.
 * Confere com `GET /auth/me` (uma conferência por vez, compartilhada) e só
 * encerra a sessão quando o back rejeita o token; erro de rede não encerra.
 */
function checkSession(): Promise<void> {
  if (sessionCheck) return sessionCheck;
  sessionCheck = (async () => {
    const token = readTokenFromCookie();
    let valid = true;
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      valid = response.ok;
    } catch {
      return;
    }
    if (valid) return;
    clearSession();
    void clearAppCaches();
    const { pathname, search } = window.location;
    if (pathname.startsWith("/login")) return;
    const current = `${pathname}${search}`;
    sessionNavigator.goToLogin(pathname.startsWith("/admin") ? current : null);
  })().finally(() => {
    sessionCheck = null;
  });
  return sessionCheck;
}

const SESSION_ERROR_STATUSES = [401, 403, 500];

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
    const payload = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      const message =
        (isJson &&
        payload &&
        typeof payload === "object" &&
        "message" in payload
          ? String((payload as { message: unknown }).message)
          : null) ?? `Erro ${response.status}`;
      if (
        auth &&
        SESSION_ERROR_STATUSES.includes(response.status) &&
        path !== "/auth/me" &&
        path !== "/auth/login"
      ) {
        await checkSession();
      }
      throw new ApiError(response.status, message, payload);
    }

    return payload as T;
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
