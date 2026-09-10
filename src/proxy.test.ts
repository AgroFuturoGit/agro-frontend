import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy, resolveAccess } from "@/proxy";

/**
 * Matriz completa (F01-rbac-navegacao + F02-organizacoes-comunidades +
 * navegacao-cascata-organizacoes):
 *
 * A navegação em cascata (Organização → Comunidade → Produtor → Planos)
 * removeu `/admin/produtores`, `/admin/comunidades` e `/admin/cultivos` —
 * substituídas por rotas aninhadas sob `/admin/organizacoes/...`. O proxy
 * não restringe mais `/admin/organizacoes` por prefixo de role: as 4 roles
 * válidas passam por ele (`ADMIN`/`TECHNICIAN` veem a lista completa,
 * `MANAGER`/`PRODUCER` são redirecionados client-side para o próprio
 * recurso — guarda de ownership feita nos componentes, não aqui).
 *
 * | Role / Cookie          | /admin/perfis        | /admin/usuarios      | /admin/relatorios | /admin, /admin/culturas, /admin/safras, /admin/organizacoes (e aninhadas) |
 * |-------------------------|----------------------|-----------------------|--------------------|------------------------------------------------------------------------------|
 * | ADMIN                   | permitido            | permitido             | permitido          | permitido                                                                     |
 * | MANAGER                  | redirect /admin      | permitido             | permitido          | permitido (guarda de ownership é client-side, não no proxy)                  |
 * | TECHNICIAN               | redirect /admin      | redirect /admin       | permitido          | permitido                                                                     |
 * | PRODUCER                 | redirect /admin      | redirect /admin       | permitido          | permitido (resolução/guarda são client-side)                                 |
 * | ausente (undefined)      | redirect /login      | redirect /login       | redirect /login    | redirect /login                                                               |
 * | corrompida ("HACKER")    | redirect /login      | redirect /login       | redirect /login    | redirect /login                                                               |
 * | lowercase ("admin")      | redirect /login      | redirect /login       | redirect /login    | redirect /login                                                               |
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

type Expectation = { action: "next" } | { action: "redirect"; to: string };

const NEXT: Expectation = { action: "next" };
const REDIRECT_ADMIN: Expectation = { action: "redirect", to: "/admin" };
const REDIRECT_LOGIN: Expectation = { action: "redirect", to: "/login" };

// Matriz role válida × grupo de rota (linhas ADMIN/MANAGER/TECHNICIAN/PRODUCER).
const VALID_ROLE_MATRIX: Record<string, Record<string, Expectation>> = {
  ADMIN: {
    "/admin/perfis": NEXT,
    "/admin/usuarios": NEXT,
    "/admin/relatorios": NEXT,
    "/admin, /admin/culturas, /admin/safras, /admin/organizacoes": NEXT,
  },
  MANAGER: {
    "/admin/perfis": REDIRECT_ADMIN,
    "/admin/usuarios": NEXT,
    "/admin/relatorios": NEXT,
    "/admin, /admin/culturas, /admin/safras, /admin/organizacoes": NEXT,
  },
  TECHNICIAN: {
    "/admin/perfis": REDIRECT_ADMIN,
    "/admin/usuarios": REDIRECT_ADMIN,
    "/admin/relatorios": NEXT,
    "/admin, /admin/culturas, /admin/safras, /admin/organizacoes": NEXT,
  },
  PRODUCER: {
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
  it("PRODUCER sem acesso a /admin/perfis → NextResponse.redirect 307 para /admin", () => {
    const request = new NextRequest("http://localhost:3000/admin/perfis", {
      headers: {
        cookie: "agro_token=valid-token; agro_role=PRODUCER",
      },
    });

    const response = proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/admin");
  });

  it("sem token em /admin/* → NextResponse.redirect 307 para /login?from=...", () => {
    const request = new NextRequest("http://localhost:3000/admin/usuarios");

    const response = proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login?from=/admin/usuarios",
    );
  });

  it("MANAGER acessando /admin/organizacoes → NextResponse.next (sem redirecionamento no proxy — guarda de ownership é client-side)", () => {
    const request = new NextRequest("http://localhost:3000/admin/organizacoes", {
      headers: {
        cookie: "agro_token=valid-token; agro_role=MANAGER",
      },
    });

    const response = proxy(request);

    // NextResponse.next() não seta status de redirect nem header location.
    expect(response.headers.get("location")).toBeNull();
  });
});
