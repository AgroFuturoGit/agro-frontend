export type Role = "ADMIN" | "MANAGER" | "TECHNICIAN" | "PRODUCER";

export type AuthUser = {
  id: number;
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
export const AUTH_USER_STORAGE_KEY = "agro_user";

const FOUR_HOURS_SECONDS = 60 * 60 * 4;

export function persistSession({ token, userResponseDTO }: LoginResponse) {
  document.cookie = `${AUTH_TOKEN_COOKIE}=${token}; Path=/; Max-Age=${FOUR_HOURS_SECONDS}; SameSite=Lax`;
  localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(userResponseDTO));
}

export function clearSession() {
  document.cookie = `${AUTH_TOKEN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  localStorage.removeItem(AUTH_USER_STORAGE_KEY);
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

export function readTokenFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${AUTH_TOKEN_COOKIE}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}
