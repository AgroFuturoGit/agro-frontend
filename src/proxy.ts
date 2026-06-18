import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_TOKEN_COOKIE = "agro_token";
const AUTH_ROLE_COOKIE = "agro_role";

const ADMIN_ONLY_PREFIXES = ["/admin/perfis"];
const ADMIN_OR_MANAGER_PREFIXES = ["/admin/usuarios", "/admin/produtores"];
const PRODUCER_ONLY_PREFIXES = ["/admin/cultivos", "/admin/relatorios"];

function matchesAny(pathname: string, prefixes: string[]) {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_TOKEN_COOKIE)?.value;
  const role = request.cookies.get(AUTH_ROLE_COOKIE)?.value;

  if (pathname.startsWith("/admin") && !token) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/login") && token) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (token && matchesAny(pathname, ADMIN_ONLY_PREFIXES) && role !== "ADMIN") {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (
    token &&
    matchesAny(pathname, ADMIN_OR_MANAGER_PREFIXES) &&
    role !== "ADMIN" &&
    role !== "MANAGER"
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (
    token &&
    matchesAny(pathname, PRODUCER_ONLY_PREFIXES) &&
    role !== "PRODUCER"
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/login"],
};
