import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiRequest, parseFieldErrors, sessionNavigator } from "@/lib/api";
import { persistSession, readTokenFromCookie } from "@/lib/auth";
import { parseOccurrenceFieldErrors } from "@/lib/occurrences";
import { parseSocialFieldErrors } from "@/lib/farmer-social";

describe("parseFieldErrors (UNIT-004)", () => {
  it("extrai erros por campo de 'campo: msg; campo: msg'", () => {
    expect(
      parseFieldErrors({ message: "name: Obrigatório; age: Deve ser positiva" }),
    ).toEqual({ name: "Obrigatório", age: "Deve ser positiva" });
  });

  it("ignora payload sem formato de campo", () => {
    expect(parseFieldErrors({ message: "Acesso negado" })).toEqual({});
    expect(parseFieldErrors(null)).toEqual({});
    expect(parseFieldErrors("x")).toEqual({});
    expect(parseFieldErrors({ message: 3 })).toEqual({});
  });

  it("é o mesmo parser usado pelas libs sociais e de ocorrências", () => {
    expect(parseSocialFieldErrors).toBe(parseFieldErrors);
    expect(parseOccurrenceFieldErrors).toBe(parseFieldErrors);
  });
});

// O Node recente expõe um `localStorage` global próprio que sobrepõe o do jsdom
// (indefinido sem --localstorage-file): troca por um armazenamento em memória.
function installMemoryStorage() {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  });
}

function res(status: number, body: unknown = { message: "x" }) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("conferência de sessão no apiRequest (UNIT-001)", () => {
  let goToLogin: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    installMemoryStorage();
    persistSession({
      token: "tok",
      userResponseDTO: {
        id: "1",
        fullName: "A",
        email: "a@x.com",
        cpf: "1",
        role: "ADMIN",
        dateOfBirth: null,
      },
    });
    window.history.replaceState({}, "", "/admin/usuarios?page=2");
    goToLogin = vi.spyOn(sessionNavigator, "goToLogin").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  for (const status of [401, 403, 500]) {
    it(`${status} com /auth/me falhando encerra a sessão e vai ao login`, async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => (String(url).endsWith("/auth/me") ? res(500) : res(status))),
      );

      await expect(apiRequest("/users")).rejects.toBeInstanceOf(ApiError);

      expect(readTokenFromCookie()).toBeNull();
      expect(localStorage.getItem("agro_user")).toBeNull();
      expect(goToLogin).toHaveBeenCalledWith("/admin/usuarios?page=2");
    });
  }

  it("403 com /auth/me 200 mantém a sessão e o erro original", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        String(url).endsWith("/auth/me") ? res(200, {}) : res(403, { message: "Acesso negado" }),
      ),
    );

    await expect(apiRequest("/users")).rejects.toMatchObject({
      status: 403,
      message: "Acesso negado",
    });

    expect(readTokenFromCookie()).toBe("tok");
    expect(goToLogin).not.toHaveBeenCalled();
  });

  it("erro de rede no /auth/me não encerra a sessão", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).endsWith("/auth/me")) throw new TypeError("net");
        return res(500);
      }),
    );

    await expect(apiRequest("/users")).rejects.toBeInstanceOf(ApiError);

    expect(readTokenFromCookie()).toBe("tok");
    expect(goToLogin).not.toHaveBeenCalled();
  });

  it("chamadas simultâneas fazem uma só conferência", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      String(url).endsWith("/auth/me") ? res(500) : res(403),
    );
    vi.stubGlobal("fetch", fetchMock);

    await Promise.allSettled([apiRequest("/a"), apiRequest("/b"), apiRequest("/c")]);

    const meCalls = fetchMock.mock.calls.filter(([u]) => String(u).endsWith("/auth/me"));
    expect(meCalls).toHaveLength(1);
    expect(goToLogin).toHaveBeenCalledTimes(1);
  });

  it("não confere sessão em /auth/login nem em chamadas sem auth", async () => {
    const fetchMock = vi.fn(async () => res(403));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest("/auth/login", { auth: false })).rejects.toBeInstanceOf(ApiError);
    await expect(apiRequest("/public", { auth: false })).rejects.toBeInstanceOf(ApiError);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(readTokenFromCookie()).toBe("tok");
  });
});
