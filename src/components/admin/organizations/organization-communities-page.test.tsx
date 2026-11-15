import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OrganizationCommunitiesPage } from "@/components/admin/organizations/organization-communities-page";
import { useIsMobile } from "@/hooks/use-mobile";
import { ApiError } from "@/lib/api";
import { readUserFromStorage, type Role } from "@/lib/auth";
import { listCommunities, type Community } from "@/lib/communities";
import { getMyManager, type Manager } from "@/lib/managers";
import { getOrganization, type Organization } from "@/lib/organizations";
import { resetNavigationMock, router } from "@/test/next-navigation";

vi.mock("next/navigation", async () => {
  const { navigationMockModule } = await import("@/test/next-navigation");
  return navigationMockModule;
});

vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: vi.fn(() => false) }));

vi.mock("@/lib/communities", async () => {
  const actual = await vi.importActual<typeof import("@/lib/communities")>(
    "@/lib/communities",
  );
  return { ...actual, listCommunities: vi.fn() };
});

vi.mock("@/lib/organizations", async () => {
  const actual = await vi.importActual<typeof import("@/lib/organizations")>(
    "@/lib/organizations",
  );
  return { ...actual, getOrganization: vi.fn() };
});

vi.mock("@/lib/managers", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/managers")>("@/lib/managers");
  return { ...actual, getMyManager: vi.fn() };
});

vi.mock("@/lib/auth", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return { ...actual, readUserFromStorage: vi.fn() };
});

const ORGANIZATION: Organization = {
  id: "org-a",
  name: "Cooperativa Alfa",
  taxId: "11111111000191",
  type: "COOP",
};

const COMMUNITIES: Community[] = [
  { id: "c-3", name: "Vale Verde", organization: ORGANIZATION },
  { id: "c-1", name: "Baixa Grande", organization: ORGANIZATION },
  { id: "c-2", name: "Serra Azul", organization: ORGANIZATION },
];

function loginAs(role: Role) {
  vi.mocked(readUserFromStorage).mockReturnValue({
    id: "current",
    fullName: "Usuário Atual",
    email: "atual@agro.com",
    cpf: "00000000000",
    role,
    dateOfBirth: null,
  });
}

function bodyNames() {
  return screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => row.querySelectorAll("td")[0]?.textContent);
}

beforeEach(() => {
  vi.mocked(getOrganization).mockResolvedValue(ORGANIZATION);
  vi.mocked(listCommunities).mockResolvedValue(COMMUNITIES);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.mocked(useIsMobile).mockReturnValue(false);
  vi.useRealTimers();
  resetNavigationMock();
});

describe("OrganizationCommunitiesPage — listagem", () => {
  it("ADMIN: lista as comunidades em ordem alfabética com ação de editar", async () => {
    loginAs("ADMIN");

    render(<OrganizationCommunitiesPage orgId="org-a" />);
    await screen.findByText("Baixa Grande");

    expect(bodyNames()).toEqual(["Baixa Grande", "Serra Azul", "Vale Verde"]);
    expect(listCommunities).toHaveBeenCalledWith("org-a");
    expect(screen.getAllByRole("button", { name: /^Editar comunidade/ })).toHaveLength(3);
    expect(
      screen.getByRole("button", { name: "Editar comunidade Serra Azul" }),
    ).toBeTruthy();
  });

  it("filtra por nome após o debounce", async () => {
    loginAs("ADMIN");

    render(<OrganizationCommunitiesPage orgId="org-a" />);
    await screen.findByText("Baixa Grande");

    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.type(screen.getByPlaceholderText("Buscar por nome…"), "serra");
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    vi.useRealTimers();

    await waitFor(() => {
      expect(bodyNames()).toEqual(["Serra Azul"]);
    });
  });

  it("MANAGER de outra organização é redirecionado sem listar nada", async () => {
    loginAs("MANAGER");
    const manager = {
      id: "manager-1",
      organization: { ...ORGANIZATION, id: "org-b" },
    } as Manager;
    vi.mocked(getMyManager).mockResolvedValue(manager);

    render(<OrganizationCommunitiesPage orgId="org-a" />);

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith("/admin/organizacoes/org-b"),
    );
    expect(listCommunities).not.toHaveBeenCalled();
  });

  it("em viewport mobile renderiza cards, sem <table>", async () => {
    loginAs("ADMIN");
    vi.mocked(useIsMobile).mockReturnValue(true);

    render(<OrganizationCommunitiesPage orgId="org-a" />);

    expect(await screen.findByText("Baixa Grande")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getAllByRole("button", { name: /^Editar comunidade/ })).toHaveLength(3);
  });

  it("breadcrumb acima do título com o nome da organização e CTA 'Nova comunidade'", async () => {
    loginAs("ADMIN");

    render(<OrganizationCommunitiesPage orgId="org-a" />);

    const heading = await screen.findByRole("heading", {
      level: 2,
      name: "Cooperativa Alfa",
    });
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(nav.textContent).toContain("Organizações");
    expect(nav.textContent).toContain("Cooperativa Alfa");
    // O breadcrumb vem antes do título no documento.
    expect(
      nav.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Nova comunidade" })).toBeTruthy();
  });

  it("lista vazia: dica e CTA que abre o drawer de criação", async () => {
    loginAs("ADMIN");
    vi.mocked(listCommunities).mockResolvedValueOnce([]);

    render(<OrganizationCommunitiesPage orgId="org-a" />);

    expect(
      await screen.findByText("Nenhuma comunidade cadastrada nesta organização ainda."),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Cadastre a primeira comunidade desta organização informando o nome dela.",
      ),
    ).toBeTruthy();

    await userEvent.setup().click(
      screen.getByRole("button", { name: "Criar primeira comunidade" }),
    );
    expect(await screen.findByRole("dialog", { name: "Nova comunidade" })).toBeTruthy();
  });

  it("erro de carregamento mostra a mensagem da API e 'Tentar novamente'", async () => {
    loginAs("ADMIN");
    vi.mocked(listCommunities).mockRejectedValueOnce(
      new ApiError(500, "Falha ao listar comunidades", null),
    );

    render(<OrganizationCommunitiesPage orgId="org-a" />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Falha ao listar comunidades");
    expect(
      screen.queryByText("Nenhuma comunidade cadastrada nesta organização ainda."),
    ).toBeNull();

    await userEvent.setup().click(
      screen.getByRole("button", { name: "Tentar novamente" }),
    );
    expect(await screen.findByText("Baixa Grande")).toBeTruthy();
  });
});
