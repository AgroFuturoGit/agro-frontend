import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiDownload, apiRequest, isConcurrencyConflict, parseFieldErrors, sessionNavigator } from "@/lib/api";
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

describe("apiDownload (UNIT-001)", () => {
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
    window.history.replaceState({}, "", "/admin");
    goToLogin = vi.spyOn(sessionNavigator, "goToLogin").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function file(headers: Record<string, string> = {}) {
    return new Response("PDFDATA", {
      status: 200,
      headers: { "content-type": "application/pdf", ...headers },
    });
  }

  it("devolve o Blob e o nome do Content-Disposition, enviando o token", async () => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () =>
      file({ "content-disposition": 'attachment; filename="relatorio-x.pdf"' }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { blob, filename } = await apiDownload("/analytics/x/export?format=pdf");

    expect(filename).toBe("relatorio-x.pdf");
    expect(await blob.text()).toBe("PDFDATA");
    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.get("Authorization")).toBe("Bearer tok");
  });

  it("entende filename* com acento", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        file({
          "content-disposition":
            "attachment; filename=\"relatorio-jose.pdf\"; filename*=UTF-8''relat%C3%B3rio-jos%C3%A9.pdf",
        }),
      ),
    );
    expect((await apiDownload("/x")).filename).toBe("relatório-josé.pdf");
  });

  it.each([
    ["../../x.pdf", "x.pdf"],
    ["a/b\\c.xlsx", "abc.xlsx"],
    ["..", "relatorio"],
    ["/.pdf", ".pdf"],
  ])("sanitiza o nome %s", async (raw, expected) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => file({ "content-disposition": `attachment; filename="${raw}"` })),
    );
    expect((await apiDownload("/x")).filename).toBe(expected);
  });

  it("nome com 300 caracteres é limitado a 150", async () => {
    const long = `${"a".repeat(296)}.pdf`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => file({ "content-disposition": `attachment; filename="${long}"` })),
    );
    expect((await apiDownload("/x")).filename).toHaveLength(150);
  });

  it("nome vazio após sanitizar cai em relatorio", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => file({ "content-disposition": "attachment; filename*=UTF-8''%2F..%2F" })),
    );
    expect((await apiDownload("/x")).filename).toBe("relatorio");
  });

  it("sem header usa o nome padrão informado", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => file()));
    expect((await apiDownload("/x", "relatorio.xlsx")).filename).toBe("relatorio.xlsx");
    expect((await apiDownload("/x")).filename).toBe("relatorio");
  });

  it("erro JSON vira ApiError com a mensagem do back", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => res(400, { message: "Formato de exportação inválido" })));
    await expect(apiDownload("/x")).rejects.toMatchObject({
      status: 400,
      message: "Formato de exportação inválido",
    });
    expect(goToLogin).not.toHaveBeenCalled();
  });

  it("401 encerra a sessão", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => res(401, { message: "Token inválido" })));
    await expect(apiDownload("/x")).rejects.toMatchObject({ status: 401 });
    expect(readTokenFromCookie()).toBeNull();
    expect(goToLogin).toHaveBeenCalledWith("/admin");
  });
});
