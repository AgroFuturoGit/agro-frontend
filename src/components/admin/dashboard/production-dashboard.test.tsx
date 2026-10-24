import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ProductionDashboard } from "@/components/admin/dashboard/production-dashboard";
import { ApiError } from "@/lib/api";
import { readUserFromStorage, type AuthUser, type Role } from "@/lib/auth";
import { getProductionDashboard, type ProductionDashboard as Dashboard } from "@/lib/production";

vi.mock("@/lib/production", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/production")>("@/lib/production");
  return { ...actual, getProductionDashboard: vi.fn() };
});

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return { ...actual, readUserFromStorage: vi.fn() };
});

const DASHBOARD: Dashboard = {
  farmerCount: 3,
  planCount: 4,
  expectedYield: 40000,
  actualYield: 18000,
  difference: -22000,
  percentageRealized: 45,
  communities: [
    {
      communityId: "c-1",
      communityName: "Alto da Serra",
      farmerCount: 2,
      planCount: 3,
      expectedYield: 30000,
      actualYield: 18000,
      difference: -12000,
      percentageRealized: 60,
    },
    {
      communityId: null,
      communityName: "Sem comunidade",
      farmerCount: 1,
      planCount: 1,
      expectedYield: 10000,
      actualYield: 0,
      difference: -10000,
      percentageRealized: 0,
    },
  ],
};

function loginAs(role: Role | null) {
  vi.mocked(readUserFromStorage).mockReturnValue(
    role
      ? ({ id: "u", fullName: "Fulano", email: "f@a.com", cpf: "1", role, dateOfBirth: null } as AuthUser)
      : null,
  );
}

beforeEach(() => {
  loginAs("ADMIN");
  vi.mocked(getProductionDashboard).mockResolvedValue(DASHBOARD);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ProductionDashboard — números e recorte por perfil (UNIT-007)", () => {
  it.each(["ADMIN", "MANAGER", "TECHNICIAN"] as const)(
    "%s: totais e tabela por comunidade, com 'Sem comunidade'",
    async (role) => {
      loginAs(role);
      render(<ProductionDashboard />);

      expect(await screen.findByText("40.000 kg")).toBeTruthy();
      expect(screen.getByText("18.000 kg")).toBeTruthy();
      expect(screen.getByText("-22.000 kg")).toBeTruthy();
      expect(screen.getByRole("img", { name: "45% da meta alcançada" })).toBeTruthy();
      expect(screen.getByText("Planos de produção")).toBeTruthy();
      expect(screen.getByRole("columnheader", { name: "Comunidade" })).toBeTruthy();
      expect(screen.getByText("Alto da Serra")).toBeTruthy();
      expect(screen.getByText("Sem comunidade")).toBeTruthy();
      expect(screen.getByText("60%")).toBeTruthy();
    },
  );

  it("FARMER: só os totais, sem tabela por comunidade", async () => {
    loginAs("FARMER");
    render(<ProductionDashboard />);

    expect(await screen.findByText("40.000 kg")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByText("Alto da Serra")).toBeNull();
  });

  it("role desconhecida: sem tabela (falha fechado)", async () => {
    loginAs(null);
    render(<ProductionDashboard />);

    expect(await screen.findByText("40.000 kg")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("deixa claro que o realizado considera só apontamentos validados", async () => {
    render(<ProductionDashboard />);
    expect(await screen.findByText(/apenas apontamentos validados/)).toBeTruthy();
  });
});

describe("ProductionDashboard — estados (UNIT-008)", () => {
  it("mostra carregamento enquanto a chamada não resolve", () => {
    vi.mocked(getProductionDashboard).mockReturnValue(new Promise(() => {}));
    render(<ProductionDashboard />);
    expect(screen.getByLabelText("Carregando painel")).toBeTruthy();
  });

  it("planCount = 0: texto explicativo no lugar do gauge", async () => {
    vi.mocked(getProductionDashboard).mockResolvedValue({
      ...DASHBOARD,
      planCount: 0,
      communities: [],
    });
    render(<ProductionDashboard />);

    expect(await screen.findByText("Nenhum plano de produção no seu recorte")).toBeTruthy();
    expect(screen.queryByRole("img", { name: /da meta alcançada/ })).toBeNull();
  });

  it("erro mostra a mensagem do back e 'Tentar novamente' recupera", async () => {
    vi.mocked(getProductionDashboard)
      .mockRejectedValueOnce(new ApiError(403, "Técnico não encontrado.", null))
      .mockResolvedValue(DASHBOARD);
    render(<ProductionDashboard />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Técnico não encontrado.");

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByText("40.000 kg")).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(getProductionDashboard).toHaveBeenCalledTimes(2);
  });

  it("erro que não é ApiError usa a mensagem genérica", async () => {
    vi.mocked(getProductionDashboard).mockRejectedValue(new Error("boom"));
    render(<ProductionDashboard />);
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Não foi possível carregar o painel de produção.",
    );
  });
});
