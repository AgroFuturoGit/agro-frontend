import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy, resolveAccess } from "@/proxy";

/**
 * Matriz completa (F01-rbac-navegacao + F02-organizacoes-comunidades +
 * navegacao-cascata-organizacoes):
 *
 * A navegação em cascata (Organização → Comunidade → Agricultor → Planos)
 * removeu `/admin/produtores`, `/admin/comunidades` e `/admin/cultivos` —
 * substituídas por rotas aninhadas sob `/admin/organizacoes/...`. O proxy
 * não restringe mais `/admin/organizacoes` por prefixo de role: as 4 roles
 * válidas passam por ele (`ADMIN`/`TECHNICIAN` veem a lista completa,
 * `MANAGER`/`FARMER` são redirecionados client-side para o próprio
 * recurso — guarda de ownership feita nos componentes, não aqui).
 *
 * | Role / Cookie          | /admin/perfis        | /admin/usuarios      | /admin/relatorios | /admin, /admin/culturas, /admin/safras, /admin/organizacoes (e aninhadas) |
 * |-------------------------|----------------------|-----------------------|--------------------|------------------------------------------------------------------------------|
 * | ADMIN                   | permitido            | permitido             | redirect /admin    | permitido                                                                     |
 * | MANAGER                  | redirect /admin      | permitido             | redirect /admin    | permitido (guarda de ownership é client-side, não no proxy)                  |
 * | TECHNICIAN               | redirect /admin      | redirect /admin       | redirect /admin    | permitido                                                                     |
 * | FARMER                 | redirect /admin      | redirect /admin       | permitido          | permitido (resolução/guarda são client-side)                                 |
 * | ausente (undefined)      | redirect /login      | redirect /login       | redirect /login    | redirect /login                                                               |
 * | corrompida ("HACKER")    | redirect /login      | redirect /login       | redirect /login    | redirect /login                                                               |
 * | lowercase ("admin")      | redirect /login      | redirect /login       | redirect /login    | redirect /login                                                               |
 * | obsoleta ("PRODUCER")    | redirect /login      | redirect /login       | redirect /login    | redirect /login                                                               |
 *
 * Toda linha de role inválida (inclusive a role obsoleta da migração
 * Producer → Farmer) encerra a sessão junto do redirect — ver a suíte
 * "encerramento de sessão com role obsoleta (anti-loop)" no fim do arquivo.
 */

const ROUTE_GROUPS: Record<string, string[]> = {
  "/admin/perfis": ["/admin/perfis"],
  "/admin/usuarios": ["/admin/usuarios"],
  "/admin/relatorios": ["/admin/relatorios"],
  "/admin, /admin/culturas, /admin/safras, /admin/organizacoes": [
    "/admin",
    "/admin/culturas",
    "/admin/safras",
    "/admin/organizacoes",
    "/admin/organizacoes/org-1",
    "/admin/organizacoes/org-1/comunidades/community-1",
    "/admin/organizacoes/org-1/comunidades/community-1/produtores/producer-1",
    "/admin/organizacoes/org-1/comunidades/community-1/produtores/producer-1/planos/plan-1",
  ],
};

type Expectation =
  | { action: "next" }
  | { action: "redirect"; to: string; clearSession?: true };

const NEXT: Expectation = { action: "next" };
const REDIRECT_ADMIN: Expectation = { action: "redirect", to: "/admin" };
// Role inválida = sessão não confiável: além do redirect, o proxy encerra a
// sessão (apaga `agro_token`/`agro_role`) — sem isso o token sobrevivente
// devolve o usuário a `/admin` e o ciclo recomeça.
const REDIRECT_LOGIN: Expectation = {
  action: "redirect",
  to: "/login",
  clearSession: true,
};

// Matriz role válida × grupo de rota (linhas ADMIN/MANAGER/TECHNICIAN/FARMER).
const VALID_ROLE_MATRIX: Record<string, Record<string, Expectation>> = {
  ADMIN: {
    "/admin/perfis": NEXT,
    "/admin/usuarios": NEXT,
    "/admin/relatorios": REDIRECT_ADMIN,
    "/admin, /admin/culturas, /admin/safras, /admin/organizacoes": NEXT,
  },
  MANAGER: {
    "/admin/perfis": REDIRECT_ADMIN,
    "/admin/usuarios": NEXT,
    "/admin/relatorios": REDIRECT_ADMIN,
    "/admin, /admin/culturas, /admin/safras, /admin/organizacoes": NEXT,
  },
  TECHNICIAN: {
    "/admin/perfis": REDIRECT_ADMIN,
    "/admin/usuarios": REDIRECT_ADMIN,
    "/admin/relatorios": REDIRECT_ADMIN,
    "/admin, /admin/culturas, /admin/safras, /admin/organizacoes": NEXT,
  },
  FARMER: {
    "/admin/perfis": REDIRECT_ADMIN,
    "/admin/usuarios": REDIRECT_ADMIN,
    "/admin/relatorios": NEXT,
    "/admin, /admin/culturas, /admin/safras, /admin/organizacoes": NEXT,
  },
};

// Variantes de role inválida: todas redirecionam para /login, independente da rota.
const INVALID_ROLE_VARIANTS: Record<string, string | undefined> = {
  "ausente (undefined)": undefined,
  'vazia ("")': "",
  'corrompida ("HACKER")': "HACKER",
  'lowercase ("admin")': "admin",
  // Role da migração Producer → Farmer: cookies gravados antes da troca
  // ainda circulam (Max-Age de 4h) e agora são inválidos.
  'obsoleta ("PRODUCER")': "PRODUCER",
};

describe("resolveAccess — matriz de RBAC", () => {
  describe.each(Object.entries(VALID_ROLE_MATRIX))("role=%s", (role, routeExpectations) => {
    it.each(Object.entries(routeExpectations))(
      `%s → ${role}`,
      (groupLabel, expectation) => {
        for (const pathname of ROUTE_GROUPS[groupLabel]) {
          const decision = resolveAccess({
            pathname,
            token: "valid-token",
            role,
          });
          expect(decision).toEqual(expectation);
        }
      },
    );
  });

  describe.each(Object.entries(INVALID_ROLE_VARIANTS))("role=%s", (variantLabel, role) => {
    it.each(Object.entries(ROUTE_GROUPS))(
      `%s → ${variantLabel}`,
      (_groupLabel, pathnames) => {
        for (const pathname of pathnames) {
          const decision = resolveAccess({
            pathname,
            token: "valid-token",
            role,
          });
          expect(decision).toEqual(REDIRECT_LOGIN);
        }
      },
    );
  });
});

describe("resolveAccess — casos de não-regressão (token/login)", () => {
  it("sem token em rota /admin/* → redirect /login?from=...", () => {
    const decision = resolveAccess({ pathname: "/admin/usuarios", token: undefined });
    expect(decision).toEqual({
      action: "redirect",
      to: "/login?from=/admin/usuarios",
    });
  });

  it("/login sem token → segue (formulário de login)", () => {
    const decision = resolveAccess({ pathname: "/login", token: undefined });
    expect(decision).toEqual({ action: "next" });
  });

  it("/login com token válido → redirect /admin", () => {
    const decision = resolveAccess({
      pathname: "/login",
      token: "valid-token",
      role: "ADMIN",
    });
    expect(decision).toEqual({ action: "redirect", to: "/admin" });
  });
});

describe("proxy — tradução para NextResponse (NextRequest real)", () => {
  it("FARMER sem acesso a /admin/perfis → NextResponse.redirect 307 para /admin", async () => {
    const request = new NextRequest("http://localhost:3000/admin/perfis", {
      headers: {
        cookie: "agro_token=valid-token; agro_role=FARMER",
      },
    });

    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/admin");
  });

  it("sem token em /admin/* → NextResponse.redirect 307 para /login?from=...", async () => {
    const request = new NextRequest("http://localhost:3000/admin/usuarios");

    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login?from=/admin/usuarios",
    );
  });

  it("MANAGER acessando /admin/organizacoes → NextResponse.next (sem redirecionamento no proxy — guarda de ownership é client-side)", async () => {
    const request = new NextRequest("http://localhost:3000/admin/organizacoes", {
      headers: {
        cookie: "agro_token=valid-token; agro_role=MANAGER",
      },
    });

    const response = await proxy(request);

    // NextResponse.next() não seta status de redirect nem header location.
    expect(response.headers.get("location")).toBeNull();
  });
});

/**
 * Regressão da migração Producer → Farmer: um cookie `agro_role=PRODUCER`
 * gravado antes da troca continua vivo por até 4h (Max-Age de
 * `persistSession`). Como o token ainda é válido, a ordem das regras do
 * `resolveAccess` produzia um ciclo:
 *
 *   /admin  (token + role inválida) → /login
 *   /login  (token ainda presente)  → /admin  → ... ERR_TOO_MANY_REDIRECTS
 *
 * A correção encerra a sessão no mesmo response do redirect: sem token, a
 * segunda requisição a `/login` já cai no formulário.
 */
describe("proxy — encerramento de sessão com role obsoleta (anti-loop)", () => {
  it("agro_role=PRODUCER (obsoleta) + token válido → 307 /login e apaga agro_token e agro_role", async () => {
    const request = new NextRequest("http://localhost:3000/admin", {
      headers: {
        cookie: "agro_token=valid-token; agro_role=PRODUCER",
      },
    });

    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/login");

    // Ordem de limpeza: primeiro o token (o que alimentava o ciclo), depois a
    // role — ambos com Path=/ para casar com o cookie gravado no login.
    const setCookies = response.headers.getSetCookie();
    expect(setCookies).toHaveLength(2);
    expect(setCookies[0]).toContain("agro_token=");
    expect(setCookies[0]).toContain("Path=/");
    expect(setCookies[0]).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
    expect(setCookies[1]).toContain("agro_role=");
    expect(setCookies[1]).toContain("Path=/");
    expect(setCookies[1]).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
  });

  it("o ciclo não existe mais: após a limpeza, /login sem token segue para o formulário", async () => {
    // Estado do browser depois do response acima: os dois cookies expirados.
    const request = new NextRequest("http://localhost:3000/login");

    const response = await proxy(request);

    expect(response.headers.get("location")).toBeNull();
  });

  it("role válida não dispara limpeza de sessão (redirect de RBAC preserva os cookies)", async () => {
    const request = new NextRequest("http://localhost:3000/admin/perfis", {
      headers: {
        cookie: "agro_token=valid-token; agro_role=FARMER",
      },
    });

    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.getSetCookie()).toEqual([]);
  });
});

function loginRequest(path: string, cookies: string) {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: cookies ? { cookie: cookies } : undefined,
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("proxy em /login (UNIT-002)", () => {
  it("token inválido abre o login e apaga os cookies", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 500 })));

    const response = await proxy(loginRequest("/login", "agro_token=ruim; agro_role=ADMIN"));

    expect(response.headers.get("location")).toBeNull();
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/agro_token=;/);
    expect(setCookie).toMatch(/agro_role=;/);
  });

  it("token válido redireciona para /admin", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));

    const response = await proxy(loginRequest("/login", "agro_token=bom; agro_role=ADMIN"));

    expect(new URL(response.headers.get("location")!).pathname).toBe("/admin");
  });

  it.each([502, 503, 504])("%i no /auth/me abre o login sem apagar cookies", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status })));

    const response = await proxy(loginRequest("/login", "agro_token=x; agro_role=ADMIN"));

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it.each([401, 403])("%i no /auth/me apaga os cookies", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status })));

    const response = await proxy(loginRequest("/login", "agro_token=x; agro_role=ADMIN"));

    expect(response.headers.get("set-cookie") ?? "").toMatch(/agro_token=;/);
  });

  it("erro de rede abre o login sem apagar cookies", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("net")));

    const response = await proxy(loginRequest("/login", "agro_token=x; agro_role=ADMIN"));

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("sem token não chama o back", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await proxy(loginRequest("/login", ""));

    expect(response.headers.get("location")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
