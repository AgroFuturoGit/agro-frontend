import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Role } from "@/lib/auth";

const AUTH_TOKEN_COOKIE = "agro_token";
const AUTH_ROLE_COOKIE = "agro_role";

const VALID_ROLES: Role[] = ["ADMIN", "MANAGER", "TECHNICIAN", "PRODUCER"];

const ADMIN_ONLY_PREFIXES = ["/admin/perfis"];
const ADMIN_OR_MANAGER_PREFIXES = ["/admin/usuarios", "/admin/produtores"];
const PRODUCER_ONLY_PREFIXES = ["/admin/cultivos", "/admin/relatorios"];

// Estas rotas eram exclusivas de PRODUCER. Agora ADMIN, MANAGER e TECHNICIAN
// também precisam consultar planos de produção e relatórios, então o grupo
// libera as 4 roles válidas — na prática a checagem abaixo não bloqueia mais
// ninguém, mas ela é mantida explícita (junto da constante) para documentar o
// grupo e servir de ponto de extensão caso a restrição volte a existir.
const PRODUCER_GROUP_ALLOWED_ROLES: Role[] = [
  "ADMIN",
  "MANAGER",
  "TECHNICIAN",
  "PRODUCER",
];

function matchesAny(pathname: string, prefixes: string[]) {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isValidRole(role?: string): role is Role {
  if (!role) return false;
  return VALID_ROLES.includes(role as Role);
}

type AccessDecision = { action: "next" } | { action: "redirect"; to: string };

/**
 * Decide se a requisição segue ou é redirecionada, a partir apenas de
 * `pathname`, `token` e `role` — função pura, sem dependência de
 * `NextRequest`/`NextResponse`, para ser testável diretamente.
 *
 * ATENÇÃO: esta checagem é a primeira linha de defesa (UX), NÃO segurança
 * real. Os cookies `agro_token`/`agro_role` são gravados no browser e podem
 * ser forjados pelo usuário. A API é a única fonte de verdade de
 * autorização — toda rota protegida precisa ser validada no backend.
 */
export function resolveAccess(params: {
  pathname: string;
  token?: string;
  role?: string;
}): AccessDecision {
  const { pathname, token, role } = params;
  const isAdminRoute = pathname.startsWith("/admin");

  if (isAdminRoute && !token) {
    return { action: "redirect", to: `/login?from=${pathname}` };
  }

  if (pathname.startsWith("/login") && token) {
    return { action: "redirect", to: "/admin" };
  }

  // Validação GLOBAL de formato da role: vale para TODA rota /admin/*,
  // inclusive as que não pertencem a nenhum grupo de prefixo abaixo
  // (ex. /admin, /admin/culturas, /admin/safras). Role ausente, vazia ou
  // fora da lista conhecida = sessão não confiável -> tratar como deslogado.
  if (isAdminRoute && !isValidRole(role)) {
    return { action: "redirect", to: "/login" };
  }

  // A partir daqui `role` é uma Role válida.
  if (matchesAny(pathname, ADMIN_ONLY_PREFIXES) && role !== "ADMIN") {
    return { action: "redirect", to: "/admin" };
  }

  if (
    matchesAny(pathname, ADMIN_OR_MANAGER_PREFIXES) &&
    role !== "ADMIN" &&
    role !== "MANAGER"
  ) {
    return { action: "redirect", to: "/admin" };
  }

  if (
    matchesAny(pathname, PRODUCER_ONLY_PREFIXES) &&
    !PRODUCER_GROUP_ALLOWED_ROLES.includes(role as Role)
  ) {
    return { action: "redirect", to: "/admin" };
  }

  return { action: "next" };
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_TOKEN_COOKIE)?.value;
  const role = request.cookies.get(AUTH_ROLE_COOKIE)?.value;

  const decision = resolveAccess({ pathname, token, role });

  if (decision.action === "redirect") {
    const url = request.nextUrl.clone();
    const target = new URL(decision.to, request.nextUrl.origin);
    url.pathname = target.pathname;
    url.search = target.search;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/login"],
};
