import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

import { CommunityProducersPage } from "@/components/admin/communities/community-producers-page";
import { ApiError } from "@/lib/api";
import { readUserFromStorage, type AuthUser, type Role } from "@/lib/auth";
import { getCommunity, type Community } from "@/lib/communities";
import { getMyManager, type Manager } from "@/lib/managers";
import { listProducers, type Producer } from "@/lib/producers";
import type { Organization } from "@/lib/organizations";
import { resetNavigationMock, router } from "@/test/next-navigation";

vi.mock("next/navigation", async () => {
  const { navigationMockModule } = await import("@/test/next-navigation");
  return navigationMockModule;
});

vi.mock("@/lib/communities", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/communities")>(
      "@/lib/communities",
    );
  return { ...actual, getCommunity: vi.fn() };
});

vi.mock("@/lib/producers", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/producers")>("@/lib/producers");
  return { ...actual, listProducers: vi.fn() };
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

const MY_ORGANIZATION: Organization = {
  id: "org-a",
  name: "Cooperativa Alfa",
  taxId: "11111111000191",
  type: "COOP",
};

const OTHER_ORGANIZATION: Organization = {
  id: "org-b",
  name: "Cooperativa Beta",
  taxId: "22222222000191",
  type: "COOP",
};

const COMMUNITY_ALFA: Community = {
  id: "community-alfa",
  name: "Comunidade Alfa",
  organization: MY_ORGANIZATION,
};

const COMMUNITY_DE_OUTRA_ORG: Community = {
  id: "community-externa",
  name: "Comunidade Externa",
  organization: OTHER_ORGANIZATION,
};

const MY_MANAGER: Manager = {
  id: "manager-1",
  user: {
    id: "user-manager",
    fullName: "Marta Gestora",
    email: "marta@agro.com",
    cpf: "98765432100",
    role: "MANAGER",
    dateOfBirth: null,
  },
  organization: MY_ORGANIZATION,
};

const PRODUCER_ALFA: Producer = {
  id: "producer-1",
  aliasName: null,
  isCompliant: true,
  user: {
    id: "user-1",
    fullName: "Ana Alves",
    email: "ana@agro.com",
    cpf: "12345678901",
  },
  community: { id: "community-alfa", name: "Comunidade Alfa", organization: MY_ORGANIZATION },
};

function loginAs(role: Role) {
  const user: AuthUser = {
    id: "user-logado",
    fullName: "Usuário Logado",
    email: "logado@agro.com",
    cpf: "98765432100",
    role,
    dateOfBirth: null,
  };
  vi.mocked(readUserFromStorage).mockReturnValue(user);
}

beforeEach(() => {
  vi.mocked(readUserFromStorage).mockReturnValue(null);
  vi.mocked(getCommunity).mockResolvedValue(COMMUNITY_ALFA);
  vi.mocked(listProducers).mockResolvedValue([PRODUCER_ALFA]);
  vi.mocked(getMyManager).mockResolvedValue(MY_MANAGER);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  resetNavigationMock();
});

describe("CommunityProducersPage — escopo por comunidade", () => {
  it("ADMIN: lista os produtores da comunidade sem filtro adicional", async () => {
    loginAs("ADMIN");

    render(<CommunityProducersPage communityId="community-alfa" />);

    expect(await screen.findByText("Ana Alves")).toBeTruthy();
    expect(listProducers).toHaveBeenCalledExactlyOnceWith("community-alfa");
    expect(screen.getByRole("button", { name: "Novo Produtor" })).toBeTruthy();
  });

  it("MANAGER: comunidade da própria organização é exibida normalmente", async () => {
    loginAs("MANAGER");

    render(<CommunityProducersPage communityId="community-alfa" />);

    expect(await screen.findByText("Ana Alves")).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("MANAGER: comunidade de outra organização é bloqueada e redireciona (guarda de ownership)", async () => {
    loginAs("MANAGER");
    vi.mocked(getCommunity).mockResolvedValue(COMMUNITY_DE_OUTRA_ORG);

    render(<CommunityProducersPage communityId="community-externa" />);

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith(`/admin/organizacoes/${MY_ORGANIZATION.id}`),
    );
    // Nenhum dado da comunidade de outra organização chega a aparecer.
    expect(screen.queryByText("Ana Alves")).toBeNull();
  });

  it("TECHNICIAN: não vê botão de cadastro (sem afordância de escrita)", async () => {
    loginAs("TECHNICIAN");

    render(<CommunityProducersPage communityId="community-alfa" />);

    expect(await screen.findByText("Ana Alves")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Novo Produtor" }),
    ).toBeNull();
  });

  it("listagem vazia mostra o estado vazio, sem alerta", async () => {
    loginAs("ADMIN");
    vi.mocked(listProducers).mockResolvedValue([]);

    render(<CommunityProducersPage communityId="community-alfa" />);

    expect(
      await screen.findByText("Nenhum produtor cadastrado nesta comunidade ainda."),
    ).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("erro de listProducers exibe role=alert com a mensagem do ApiError", async () => {
    loginAs("ADMIN");
    vi.mocked(listProducers).mockRejectedValue(
      new ApiError(500, "Erro interno do servidor", {}),
    );

    render(<CommunityProducersPage communityId="community-alfa" />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Erro interno do servidor");
  });

  it("falha de getMyManager (MANAGER) bloqueia com alerta, sem exibir produtores", async () => {
    loginAs("MANAGER");
    vi.mocked(getMyManager).mockRejectedValue(new ApiError(500, "Falhou", {}));

    render(<CommunityProducersPage communityId="community-alfa" />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Falhou");
    expect(screen.queryByText("Ana Alves")).toBeNull();
  });
});
