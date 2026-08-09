import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SidebarNav } from "@/components/admin/sidebar-nav";
import { SidebarProvider } from "@/components/ui/sidebar";
import * as auth from "@/lib/auth";
import type { AuthUser } from "@/lib/auth";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
}));

// jsdom não implementa window.matchMedia — necessário para o hook
// useIsMobile usado internamente por <SidebarProvider>.
beforeAll(() => {
  window.matchMedia =
    window.matchMedia ??
    ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }));
});

function mockRole(role: AuthUser["role"] | null) {
  vi.spyOn(auth, "readUserFromStorage").mockReturnValue(
    role
      ? {
          id: "1",
          fullName: "Teste",
          email: "teste@agro.com",
          cpf: "00000000000",
          role,
          dateOfBirth: null,
        }
      : null,
  );
}

function renderSidebarNav() {
  return render(
    <SidebarProvider>
      <SidebarNav />
    </SidebarProvider>,
  );
}

/**
 * A navegação em cascata (Organização → Comunidade → Produtor → Planos,
 * plano `navegacao-cascata-organizacoes`) removeu "Comunidades",
 * "Produtores" e "Planos de Produção" como itens de sidebar próprios —
 * `/admin/organizacoes` passou a ser o único ponto de entrada, visível às 4
 * roles (cada uma pousa no nível certo dentro do próprio componente).
 */
describe("SidebarNav — RBAC de navegação", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it.each(["ADMIN", "MANAGER", "TECHNICIAN", "PRODUCER"] as const)(
    "exibe 'Organizações' e 'Relatórios' para role=%s (ponto de entrada único da hierarquia)",
    async (role) => {
      mockRole(role);
      renderSidebarNav();

      expect(await screen.findByText("Organizações")).toBeTruthy();
      expect(screen.getByText("Relatórios")).toBeTruthy();
    },
  );

  it.each(["ADMIN", "MANAGER", "TECHNICIAN", "PRODUCER"] as const)(
    "não exibe mais os itens antigos 'Comunidades', 'Produtores' e 'Planos de Produção' para role=%s",
    async (role) => {
      mockRole(role);
      renderSidebarNav();

      await screen.findByText("Organizações");
      expect(screen.queryByText("Comunidades")).toBeNull();
      expect(screen.queryByText("Produtores")).toBeNull();
      expect(screen.queryByText("Planos de Produção")).toBeNull();
    },
  );

  it("link de 'Organizações' aponta para /admin/organizacoes", async () => {
    mockRole("ADMIN");
    renderSidebarNav();

    const link = await screen.findByRole("link", { name: /Organizações/i });
    expect(link.getAttribute("href")).toBe("/admin/organizacoes");
  });

  it("item restrito (Perfis) permanece oculto para role sem permissão (não-regressão)", async () => {
    mockRole("PRODUCER");
    renderSidebarNav();

    await screen.findByText("Organizações");
    expect(screen.queryByText("Perfis")).toBeNull();
  });

  it("exibe 'Perfis' apenas para role=ADMIN (não-regressão)", async () => {
    mockRole("ADMIN");
    renderSidebarNav();

    expect(await screen.findByText("Perfis")).toBeTruthy();
  });

  it.each(["ADMIN", "MANAGER"] as const)(
    "exibe 'Usuários' para role=%s (não-regressão)",
    async (role) => {
      mockRole(role);
      renderSidebarNav();

      expect(await screen.findByText("Usuários")).toBeTruthy();
    },
  );

  it.each(["TECHNICIAN", "PRODUCER"] as const)(
    "esconde 'Usuários' para role=%s (não-regressão)",
    async (role) => {
      mockRole(role);
      renderSidebarNav();

      await screen.findByText("Organizações");
      expect(screen.queryByText("Usuários")).toBeNull();
    },
  );
});
