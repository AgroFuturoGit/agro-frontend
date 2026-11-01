import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiRequest, isConcurrencyConflict, parseFieldErrors, sessionNavigator } from "@/lib/api";
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

  it("401 encerra a sessão e vai ao login sem chamar /auth/me", async () => {
    const fetchMock = vi.fn<(url: string) => Promise<Response>>(async () => res(401, { message: "Token inválido" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest("/users")).rejects.toMatchObject({ status: 401 });

    expect(readTokenFromCookie()).toBeNull();
    expect(localStorage.getItem("agro_user")).toBeNull();
    expect(goToLogin).toHaveBeenCalledWith("/admin/usuarios?page=2");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("/auth/me");
  });

  for (const status of [403, 500]) {
    it(`${status} só vira erro: mantém a sessão e não chama /auth/me`, async () => {
      const fetchMock = vi.fn(async () => res(status, { message: "Acesso negado" }));
      vi.stubGlobal("fetch", fetchMock);

      await expect(apiRequest("/users")).rejects.toMatchObject({
        status,
        message: "Acesso negado",
      });

      expect(readTokenFromCookie()).toBe("tok");
      expect(goToLogin).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  }

  it("401 com corpo vazio ainda encerra a sessão", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("", { status: 401, headers: { "content-type": "application/json" } }),
      ),
    );

    await expect(apiRequest("/users")).rejects.toMatchObject({
      status: 401,
      message: "Erro 401",
    });

    expect(readTokenFromCookie()).toBeNull();
    expect(goToLogin).toHaveBeenCalled();
  });

  it("erro de rede não encerra a sessão", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("net");
      }),
    );

    await expect(apiRequest("/users")).rejects.toBeInstanceOf(TypeError);

    expect(readTokenFromCookie()).toBe("tok");
    expect(goToLogin).not.toHaveBeenCalled();
  });

  it("não encerra a sessão em /auth/login nem em chamadas sem auth", async () => {
    const fetchMock = vi.fn(async () => res(401));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest("/auth/login", { auth: false })).rejects.toBeInstanceOf(ApiError);
    await expect(apiRequest("/public", { auth: false })).rejects.toBeInstanceOf(ApiError);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(readTokenFromCookie()).toBe("tok");
    expect(goToLogin).not.toHaveBeenCalled();
  });
});

describe("Retry-After no ApiError (UNIT-004)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function resWithRetry(retryAfter: string | null) {
    const headers = new Headers({ "content-type": "application/json" });
    if (retryAfter !== null) headers.set("Retry-After", retryAfter);
    return new Response(JSON.stringify({ message: "Limite de tentativas" }), {
      status: 429,
      headers,
    });
  }

  it("expõe retryAfterSeconds lido do header", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => resWithRetry("42")));
    await expect(apiRequest("/auth/login", { auth: false })).rejects.toMatchObject({
      status: 429,
      retryAfterSeconds: 42,
    });
  });

  it("sem header ou com valor inválido, retryAfterSeconds é nulo", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => resWithRetry(null)));
    await expect(apiRequest("/auth/login", { auth: false })).rejects.toMatchObject({
      retryAfterSeconds: null,
    });
    vi.stubGlobal("fetch", vi.fn(async () => resWithRetry("amanhã")));
    await expect(apiRequest("/auth/login", { auth: false })).rejects.toMatchObject({
      retryAfterSeconds: null,
    });
  });

  it("ApiError criado à mão segue funcionando", () => {
    expect(new ApiError(400, "x", null).retryAfterSeconds).toBeNull();
  });
});

describe("isConcurrencyConflict", () => {
  it("só é verdadeiro para 409 com `current` no corpo", () => {
    expect(isConcurrencyConflict(new ApiError(409, "x", { current: { id: "1" } }))).toBe(true);
    expect(isConcurrencyConflict(new ApiError(409, "x", { message: "x" }))).toBe(false);
    expect(isConcurrencyConflict(new ApiError(409, "x", null))).toBe(false);
    expect(isConcurrencyConflict(new ApiError(400, "x", { current: {} }))).toBe(false);
  });
});
