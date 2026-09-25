import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Role } from "@/lib/auth";

const AUTH_TOKEN_COOKIE = "agro_token";
const AUTH_ROLE_COOKIE = "agro_role";

const VALID_ROLES: Role[] = ["ADMIN", "MANAGER", "TECHNICIAN", "FARMER"];

const ADMIN_ONLY_PREFIXES = ["/admin/perfis"];
const ADMIN_OR_MANAGER_PREFIXES = ["/admin/usuarios"];
// `/admin/organizacoes` (e toda a navegação em cascata Organização →
// Comunidade → Agricultor → Planos aninhada sob ela) e `/admin/relatorios`
// são compartilhadas pelas 4 roles — cada uma pousa no nível/escopo certo
// dentro dos próprios componentes (`organizations-page.tsx` etc.), não no
// proxy. `/admin/cultivos` foi removido nesta rota: a navegação de planos
// de produção agora vive só sob `/admin/organizacoes/.../produtores/...`.
const FARMER_ONLY_PREFIXES = ["/admin/relatorios"];

// Relatórios só funcionam para FARMER: a tela depende de `GET /farmers/me`,
// que o backend restringe a `hasRole('FARMER')`. ADMIN, MANAGER e TECHNICIAN
// chegavam à tela e recebiam 403 — o proxy agora os devolve a `/admin`. Se
// o backend ganhar um caminho de dados de relatório para outras roles, basta
// incluí-las aqui (e no item da sidebar).
const FARMER_GROUP_ALLOWED_ROLES: Role[] = ["FARMER"];

function matchesAny(pathname: string, prefixes: string[]) {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isValidRole(role?: string): role is Role {
  if (!role) return false;
  return VALID_ROLES.includes(role as Role);
}

type AccessDecision =
  | { action: "next" }
  /**
   * `clearSession: true` = a sessão não é confiável e deve ser encerrada
   * junto do redirect (o `proxy()` apaga `agro_token`/`agro_role`). Sem
   * isso, um cookie de role obsoleta (ex. um `agro_role` gravado antes da
   * migração Producer → Farmer, ainda vivo pelas 4h de Max-Age) entra em
   * ciclo: `/admin/*` → role inválida → `/login` → token presente →
   * `/admin` → ... → ERR_TOO_MANY_REDIRECTS.
   */
  | { action: "redirect"; to: string; clearSession?: true };

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
    return { action: "redirect", to: "/login", clearSession: true };
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
    matchesAny(pathname, FARMER_ONLY_PREFIXES) &&
    !FARMER_GROUP_ALLOWED_ROLES.includes(role as Role)
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
    const response = NextResponse.redirect(url);

    if (decision.clearSession) {
      // `path: "/"` precisa casar com o Path usado em `persistSession`
      // (`src/lib/auth.ts`) — sem ele o `Set-Cookie` de expiração nasce com
      // o path da requisição (`/admin/...`) e não apaga o cookie original.
      response.cookies.delete({ name: AUTH_TOKEN_COOKIE, path: "/" });
      response.cookies.delete({ name: AUTH_ROLE_COOKIE, path: "/" });
    }

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/login"],
};
