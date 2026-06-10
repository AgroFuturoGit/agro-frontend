import { readTokenFromCookie } from "@/lib/auth";
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
      throw new ApiError(response.status, message, payload);
    }

    return payload as T;
  } finally {
    loadingStore.stop();
  }
}
