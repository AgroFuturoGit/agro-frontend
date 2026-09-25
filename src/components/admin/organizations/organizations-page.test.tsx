import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OrganizationsPage } from "@/components/admin/organizations/organizations-page";
import { useIsMobile } from "@/hooks/use-mobile";
import { readUserFromStorage, type Role } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { listOrganizations, type Organization } from "@/lib/organizations";

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
    expect(screen.getByRole("button", { name: "Nova Organização" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Editar organização" })).toHaveLength(3);
    expect(screen.getAllByRole("button", { name: "Criar Manager" })).toHaveLength(3);
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
    expect(screen.getAllByRole("button", { name: "Editar" })).toHaveLength(3);
  });
});
