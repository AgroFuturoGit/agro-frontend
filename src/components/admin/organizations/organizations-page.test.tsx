import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OrganizationsPage } from "@/components/admin/organizations/organizations-page";
import { useIsMobile } from "@/hooks/use-mobile";
import { readUserFromStorage, type Role } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { getMyManager } from "@/lib/managers";
import { listOrganizations, type Organization } from "@/lib/organizations";
import type { Producer } from "@/lib/producers";
import { getMyAssignedProducers } from "@/lib/technicians";

vi.mock("next/navigation", async () => {
  const { navigationMockModule } = await import("@/test/next-navigation");
  return navigationMockModule;
});

vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: vi.fn(() => false) }));

vi.mock("@/lib/organizations", async () => {
  const actual = await vi.importActual<typeof import("@/lib/organizations")>(
    "@/lib/organizations",
  );
  return { ...actual, listOrganizations: vi.fn() };
});

vi.mock("@/lib/technicians", async () => {
  const actual = await vi.importActual<typeof import("@/lib/technicians")>(
    "@/lib/technicians",
  );
  return { ...actual, getMyAssignedProducers: vi.fn() };
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

const ORGANIZATIONS: Organization[] = [
  { id: "org-c", name: "Cooperativa Cerrado", taxId: "33333333000191", type: "COOP" },
  { id: "org-a", name: "Associação Alfa", taxId: "11111111000191", type: "ASSOC" },
  { id: "org-b", name: "Cooperativa Beta", taxId: "22222222000191", type: "COOP" },
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
  vi.mocked(listOrganizations).mockResolvedValue(ORGANIZATIONS);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.mocked(useIsMobile).mockReturnValue(false);
  vi.useRealTimers();
});

describe("OrganizationsPage — listagem do ADMIN", () => {
  it("lista as organizações em ordem alfabética com ações de gestão", async () => {
    loginAs("ADMIN");

    render(<OrganizationsPage />);
    await screen.findByText("Associação Alfa");

    expect(bodyNames()).toEqual([
      "Associação Alfa",
      "Cooperativa Beta",
      "Cooperativa Cerrado",
    ]);
    expect(screen.getByRole("button", { name: "Nova organização" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /^Editar organização/ })).toHaveLength(3);
    expect(screen.getAllByRole("button", { name: /^Criar gestor para/ })).toHaveLength(3);
    // O nome do registro entra no rótulo da ação.
    expect(
      screen.getByRole("button", { name: "Editar organização Cooperativa Beta" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Criar gestor para Cooperativa Beta" }),
    ).toBeTruthy();
  });

  it("filtra por CNPJ digitado com máscara após o debounce", async () => {
    loginAs("ADMIN");

    render(<OrganizationsPage />);
    await screen.findByText("Associação Alfa");

    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.type(
      screen.getByPlaceholderText("Buscar por nome ou CNPJ…"),
      "22.222.222",
    );
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    vi.useRealTimers();

    await waitFor(() => {
      expect(bodyNames()).toEqual(["Cooperativa Beta"]);
    });
  });

  it("erro de carregamento mostra a mensagem da API e 'Tentar novamente'", async () => {
    loginAs("ADMIN");
    vi.mocked(listOrganizations).mockRejectedValueOnce(
      new ApiError(500, "Falha ao listar organizações", null),
    );

    render(<OrganizationsPage />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Falha ao listar organizações");

    await userEvent.setup().click(
      screen.getByRole("button", { name: "Tentar novamente" }),
    );
    expect(await screen.findByText("Associação Alfa")).toBeTruthy();
  });

  it("em viewport mobile renderiza cards, sem <table>", async () => {
    loginAs("ADMIN");
    vi.mocked(useIsMobile).mockReturnValue(true);

    render(<OrganizationsPage />);

    expect(await screen.findByText("Associação Alfa")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getAllByRole("button", { name: /^Editar organização/ })).toHaveLength(3);
  });

  it("título em h2 e CNPJ com algarismos tabulares, sem fonte mono", async () => {
    loginAs("ADMIN");

    render(<OrganizationsPage />);
    await screen.findByText("Associação Alfa");

    expect(screen.getByRole("heading", { level: 2, name: "Organizações" })).toBeTruthy();
    const cnpj = screen.getByText("11.111.111/0001-91");
    expect(cnpj.closest("td")?.className).toContain("tabular-nums");
    expect(cnpj.closest("td")?.className).not.toContain("font-mono");
  });

  it("lista vazia: dica e CTA que abre o drawer de criação", async () => {
    loginAs("ADMIN");
    vi.mocked(listOrganizations).mockResolvedValueOnce([]);

    render(<OrganizationsPage />);

    expect(await screen.findByText("Nenhuma organização cadastrada ainda.")).toBeTruthy();
    expect(
      screen.getByText(
        "Cadastre uma cooperativa ou associação informando nome, CNPJ e tipo.",
      ),
    ).toBeTruthy();

    await userEvent.setup().click(
      screen.getByRole("button", { name: "Criar primeira organização" }),
    );
    expect(await screen.findByRole("dialog", { name: "Nova organização" })).toBeTruthy();
  });
});

function producer(
  id: string,
  fullName: string,
  community: Producer["community"],
): Producer {
  return {
    id,
    fullName,
    cpf: null,
    dateOfBirth: null,
    motherName: null,
    origin: null,
    educationLevel: null,
    phone: null,
    localName: null,
    street: null,
    city: null,
    state: null,
    ibgeCode: null,
    latitude: null,
    longitude: null,
    isCompliant: null,
    registrationSource: null,
    createdAt: null,
    updatedAt: null,
    user: null,
    community,
  };
}

describe("OrganizationsPage — agricultores atendidos (TÉCNICO)", () => {
  const ORG = ORGANIZATIONS[0];

  it("lista os agricultores em ordem alfabética com link para os planos", async () => {
    loginAs("TECHNICIAN");
    vi.mocked(getMyAssignedProducers).mockResolvedValue([
      producer("p-2", "Zélia Souza", { id: "c-1", name: "Baixa Grande", organization: ORG }),
      producer("p-1", "Ana Lima", { id: "c-1", name: "Baixa Grande", organization: ORG }),
    ]);

    render(<OrganizationsPage />);

    const link = await screen.findByRole("link", { name: "Ana Lima" });
    expect(link.getAttribute("href")).toBe(
      "/admin/organizacoes/org-c/comunidades/c-1/produtores/p-1",
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Meus agricultores atendidos" }),
    ).toBeTruthy();
    expect(bodyNames()).toEqual(["Ana Lima", "Zélia Souza"]);
    // Cabeçalho sem uppercase (Figma 135:898) e sem ações nem CTA.
    expect(screen.getByRole("columnheader", { name: "Comunidade" }).className).not.toContain(
      "uppercase",
    );
    expect(screen.queryByRole("button", { name: "Nova organização" })).toBeNull();
    expect(listOrganizations).not.toHaveBeenCalled();
  });

  it("sem comunidade: nome sem link e células com 'sem dados'", async () => {
    loginAs("TECHNICIAN");
    vi.mocked(getMyAssignedProducers).mockResolvedValue([
      producer("p-1", "Ana Lima", null),
    ]);

    render(<OrganizationsPage />);

    expect(await screen.findByText("Ana Lima")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Ana Lima" })).toBeNull();
    expect(screen.getAllByText("sem dados")).toHaveLength(2);
  });

  it("vazio com dica, sem CTA de criação", async () => {
    loginAs("TECHNICIAN");
    vi.mocked(getMyAssignedProducers).mockResolvedValue([]);

    render(<OrganizationsPage />);

    expect(await screen.findByText("Nenhum agricultor atribuído a você ainda.")).toBeTruthy();
    expect(
      screen.getByText(
        "Os agricultores aparecem aqui quando você é vinculado como técnico responsável por eles.",
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("erro mostra a mensagem da API e 'Tentar novamente', sem o vazio junto", async () => {
    loginAs("TECHNICIAN");
    vi.mocked(getMyAssignedProducers)
      .mockRejectedValueOnce(new ApiError(500, "Falha ao listar agricultores", null))
      .mockResolvedValueOnce([
        producer("p-1", "Ana Lima", { id: "c-1", name: "Baixa Grande", organization: ORG }),
      ]);

    render(<OrganizationsPage />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Falha ao listar agricultores");
    expect(screen.queryByText("Nenhum agricultor atribuído a você ainda.")).toBeNull();

    await userEvent.setup().click(
      screen.getByRole("button", { name: "Tentar novamente" }),
    );
    expect(await screen.findByRole("link", { name: "Ana Lima" })).toBeTruthy();
  });
});

describe("OrganizationsPage — redirecionamento do GESTOR", () => {
  it("falha ao identificar a organização: alerta com 'Tentar novamente'", async () => {
    loginAs("MANAGER");
    vi.mocked(getMyManager).mockRejectedValueOnce(
      new ApiError(500, "Serviço indisponível", null),
    );

    render(<OrganizationsPage />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(
      "Não foi possível identificar a sua organização: Serviço indisponível",
    );
    expect(screen.getByRole("heading", { level: 2, name: "Organizações" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeTruthy();
    expect(listOrganizations).not.toHaveBeenCalled();
  });
});
