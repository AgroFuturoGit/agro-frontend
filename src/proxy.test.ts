import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy, resolveAccess } from "@/proxy";

/**
 * Matriz completa de spec.md §5 (F01-rbac-navegacao):
 *
 * | Role / Cookie          | /admin/perfis        | /admin/usuarios, /admin/produtores | /admin/cultivos, /admin/relatorios | /admin, /admin/culturas, /admin/safras |
 * |-------------------------|----------------------|-------------------------------------|-------------------------------------|------------------------------------------|
 * | ADMIN                   | permitido            | permitido                           | permitido (novo)                    | permitido                                |
 * | MANAGER                  | redirect /admin      | permitido                           | permitido (novo)                    | permitido                                |
 * | TECHNICIAN               | redirect /admin      | redirect /admin                     | permitido (novo)                    | permitido                                |
 * | PRODUCER                 | redirect /admin      | redirect /admin                     | permitido (sem regressão)           | permitido                                |
 * | ausente (undefined)      | redirect /login      | redirect /login                     | redirect /login                     | redirect /login                          |
 * | corrompida ("HACKER")    | redirect /login      | redirect /login                     | redirect /login                     | redirect /login                          |
 * | lowercase ("admin")      | redirect /login      | redirect /login                     | redirect /login                     | redirect /login                          |
 */

const ROUTE_GROUPS: Record<string, string[]> = {
  "/admin/perfis": ["/admin/perfis"],
  "/admin/usuarios, /admin/produtores": ["/admin/usuarios", "/admin/produtores"],
  "/admin/cultivos, /admin/relatorios": ["/admin/cultivos", "/admin/relatorios"],
  "/admin, /admin/culturas, /admin/safras": ["/admin", "/admin/culturas", "/admin/safras"],
};

type Expectation = { action: "next" } | { action: "redirect"; to: string };

const NEXT: Expectation = { action: "next" };
const REDIRECT_ADMIN: Expectation = { action: "redirect", to: "/admin" };
const REDIRECT_LOGIN: Expectation = { action: "redirect", to: "/login" };

// Matriz role válida × grupo de rota (linhas ADMIN/MANAGER/TECHNICIAN/PRODUCER).
const VALID_ROLE_MATRIX: Record<string, Record<string, Expectation>> = {
  ADMIN: {
    "/admin/perfis": NEXT,
    "/admin/usuarios, /admin/produtores": NEXT,
    "/admin/cultivos, /admin/relatorios": NEXT,
    "/admin, /admin/culturas, /admin/safras": NEXT,
  },
  MANAGER: {
    "/admin/perfis": REDIRECT_ADMIN,
    "/admin/usuarios, /admin/produtores": NEXT,
    "/admin/cultivos, /admin/relatorios": NEXT,
    "/admin, /admin/culturas, /admin/safras": NEXT,
  },
  TECHNICIAN: {
    "/admin/perfis": REDIRECT_ADMIN,
    "/admin/usuarios, /admin/produtores": REDIRECT_ADMIN,
    "/admin/cultivos, /admin/relatorios": NEXT,
    "/admin, /admin/culturas, /admin/safras": NEXT,
  },
  PRODUCER: {
    "/admin/perfis": REDIRECT_ADMIN,
    "/admin/usuarios, /admin/produtores": REDIRECT_ADMIN,
    "/admin/cultivos, /admin/relatorios": NEXT,
    "/admin, /admin/culturas, /admin/safras": NEXT,
  },
};

// Variantes de role inválida: todas redirecionam para /login, independente da rota.
const INVALID_ROLE_VARIANTS: Record<string, string | undefined> = {
  "ausente (undefined)": undefined,
  'corrompida ("HACKER")': "HACKER",
  'lowercase ("admin")': "admin",
};

describe("resolveAccess — matriz de RBAC (spec.md §5)", () => {
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

  it("MANAGER acessando /admin/cultivos → NextResponse.next (sem redirecionamento)", () => {
    const request = new NextRequest("http://localhost:3000/admin/cultivos", {
      headers: {
        cookie: "agro_token=valid-token; agro_role=MANAGER",
      },
    });

    const response = proxy(request);

    // NextResponse.next() não seta status de redirect nem header location.
    expect(response.headers.get("location")).toBeNull();
  });
});
