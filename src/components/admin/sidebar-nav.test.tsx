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

describe("SidebarNav — RBAC de navegação (spec.md §2 Objective #3, CHECKLIST-F01)", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it.each(["ADMIN", "MANAGER", "TECHNICIAN", "PRODUCER"] as const)(
    "exibe 'Planos de Produção' e 'Relatórios' para role=%s (sem regressão)",
    async (role) => {
      mockRole(role);
      renderSidebarNav();

      expect(await screen.findByText("Planos de Produção")).toBeTruthy();
      expect(screen.getByText("Relatórios")).toBeTruthy();
      // não deve mais existir o rótulo antigo
      expect(screen.queryByText("Cultivos")).toBeNull();
    },
  );

  it("link de 'Planos de Produção' aponta para /admin/cultivos (URL inalterada)", async () => {
    mockRole("PRODUCER");
    renderSidebarNav();

    const link = await screen.findByRole("link", { name: /Planos de Produção/i });
    expect(link.getAttribute("href")).toBe("/admin/cultivos");
  });

  it("item restrito (Perfis) permanece oculto para role sem permissão (não-regressão)", async () => {
    mockRole("PRODUCER");
    renderSidebarNav();

    await screen.findByText("Planos de Produção");
    expect(screen.queryByText("Perfis")).toBeNull();
  });
});
