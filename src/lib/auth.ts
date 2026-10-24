export type Role = "ADMIN" | "MANAGER" | "TECHNICIAN" | "FARMER";

export type AuthUser = {
  id: string;
  fullName: string;
  email: string;
  cpf: string;
  role: Role;
  dateOfBirth: string | null;
};

export type LoginResponse = {
  token: string;
  userResponseDTO: AuthUser;
};

export const AUTH_TOKEN_COOKIE = "agro_token";
export const AUTH_ROLE_COOKIE = "agro_role";
export const AUTH_USER_STORAGE_KEY = "agro_user";

const FOUR_HOURS_SECONDS = 60 * 60 * 4;
const USER_CHANGED_EVENT = "agro:user-changed";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

function notifyUserChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(USER_CHANGED_EVENT));
  }
}

export function persistSession({ token, userResponseDTO }: LoginResponse) {
  document.cookie = `${AUTH_TOKEN_COOKIE}=${token}; Path=/; Max-Age=${FOUR_HOURS_SECONDS}; SameSite=Lax`;
  document.cookie = `${AUTH_ROLE_COOKIE}=${userResponseDTO.role}; Path=/; Max-Age=${FOUR_HOURS_SECONDS}; SameSite=Lax`;
  localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(userResponseDTO));
  notifyUserChanged();
}

export function clearSession() {
  document.cookie = `${AUTH_TOKEN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  document.cookie = `${AUTH_ROLE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  localStorage.removeItem(AUTH_USER_STORAGE_KEY);
  notifyUserChanged();
}

/**
 * Caches de runtime do service worker que podem guardar dado de usuário
 * (nomes do `defaultCache` do Serwist). O precache (`serwist-precache-*`) e os
 * caches de assets estáticos ficam intactos.
 */
const USER_DATA_CACHES = new Set([
  "apis",
  "cross-origin",
  "next-data",
  "others",
  "pages",
  "pages-rsc",
  "pages-rsc-prefetch",
  "static-data-assets",
]);

/** Apaga os caches de dados em runtime (service worker) para não sobrar dado de sessão anterior. */
export async function clearAppCaches(): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((key) => USER_DATA_CACHES.has(key)).map((key) => caches.delete(key)),
    );
  } catch {
    // Cache Storage indisponível (ex. contexto inseguro): nada a limpar.
  }
}

export function readUserFromStorage(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(AUTH_USER_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

let cachedRawUser: string | null = null;
let cachedUser: AuthUser | null = null;

export function getUserSnapshot(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(AUTH_USER_STORAGE_KEY);
  if (raw === cachedRawUser) return cachedUser;
  cachedRawUser = raw;
  if (!raw) {
    cachedUser = null;
    return null;
  }
  try {
    cachedUser = JSON.parse(raw) as AuthUser;
  } catch {
    cachedUser = null;
  }
  return cachedUser;
}

export function subscribeUserStorage(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(USER_CHANGED_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(USER_CHANGED_EVENT, callback);
  };
}

export function readTokenFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${AUTH_TOKEN_COOKIE}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

type MeResponse = Pick<AuthUser, "id" | "fullName" | "email" | "cpf" | "role"> &
  Partial<Pick<AuthUser, "dateOfBirth">>;

/**
 * Busca `GET /auth/me` e regrava a sessão local (cookie de papel e
 * `agro_user`) com o que o back devolve. Qualquer falha (rede ou HTTP) é
 * ignorada: quem encerra sessão inválida é o `apiRequest`, não esta função.
 * Devolve o usuário atualizado ou `null`.
 */
export async function refreshSessionFromServer(): Promise<AuthUser | null> {
  const token = readTokenFromCookie();
  if (!token) return null;
  try {
    const response = await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return null;
    const me = (await response.json()) as Partial<MeResponse>;
    if (!me?.id || !me.role) return null;
    // Logout ou troca de sessão durante a requisição: descarta a resposta.
    if (readTokenFromCookie() !== token) return null;
    const stored = readUserFromStorage();
    const user: AuthUser = {
      ...stored,
      ...(me as MeResponse),
      dateOfBirth: me.dateOfBirth ?? stored?.dateOfBirth ?? null,
    };
    persistSession({ token, userResponseDTO: user });
    return user;
  } catch {
    return null;
  }
}
