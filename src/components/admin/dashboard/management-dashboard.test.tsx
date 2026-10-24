import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

import { ManagementDashboard } from "@/components/admin/dashboard/management-dashboard";
import {
  getGlobalSummary,
  getManagerSummary,
  type ManagementSummary,
} from "@/lib/analytics";
import { ApiError } from "@/lib/api";
import { listCommunities } from "@/lib/communities";
import { listHarvests } from "@/lib/harvests";
import { listOrganizations } from "@/lib/organizations";

vi.mock("@/lib/analytics", () => ({
  getGlobalSummary: vi.fn(),
  getManagerSummary: vi.fn(),
}));
vi.mock("@/lib/harvests", async () => {
  const actual = await vi.importActual<typeof import("@/lib/harvests")>("@/lib/harvests");
  return { ...actual, listHarvests: vi.fn() };
});
vi.mock("@/lib/organizations", async () => {
  const actual = await vi.importActual<typeof import("@/lib/organizations")>("@/lib/organizations");
  return { ...actual, listOrganizations: vi.fn() };
});
vi.mock("@/lib/communities", async () => {
  const actual = await vi.importActual<typeof import("@/lib/communities")>("@/lib/communities");
  return { ...actual, listCommunities: vi.fn() };
});
vi.mock("@/components/admin/dashboard/crop-share-chart", () => ({
  CropShareChart: ({ ranking }: { ranking: { cropName: string }[] }) => (
    <div data-testid="crop-share-chart">{ranking.map((r) => r.cropName).join(",")}</div>
  ),
}));
vi.mock("@/components/admin/dashboard/community-target-chart", () => ({
  CommunityTargetChart: ({ communities }: { communities: { communityName: string }[] }) => (
    <div data-testid="management-community-chart">
      {communities.map((c) => c.communityName).join(",")}
    </div>
  ),
}));

// O `Select` do `@base-ui/react` só confirma o item DESTACADO no jsdom: abre
// pelo teclado e caminha até o alvo.
async function choose(name: string, label: string) {
  const trigger = screen.getByRole("combobox", { name });
  trigger.focus();
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  fireEvent.keyUp(trigger, { key: "ArrowDown" });
  const target = await screen.findByRole("option", { name: label });
  const options = screen.getAllByRole("option");
  const highlighted = () =>
    options.find((o) => o.getAttribute("data-highlighted") !== null) as HTMLElement;
  const from = options.indexOf(highlighted());
  const to = options.indexOf(target);
  const key = to > from ? "ArrowDown" : "ArrowUp";
  for (let step = 0; step < Math.abs(to - from); step += 1) {
    const current = highlighted();
    fireEvent.keyDown(current, { key });
    fireEvent.keyUp(current, { key });
  }
  fireEvent.keyDown(target, { key: "Enter" });
  fireEvent.keyUp(target, { key: "Enter" });
}

function summary(over: Partial<ManagementSummary> = {}): ManagementSummary {
  return {
    scope: "ORGANIZATION",
    organizationId: "o-1",
    organizationName: "Cooperativa Sol",
    currentHarvest: { id: "h-1", label: "Safra 2026", startDate: "2026-01-01", endDate: "2026-12-31" },
    appliedCommunityId: null,
    isEmpty: false,
    totalOrganizationsCount: 1,
    totalCommunitiesCount: 2,
    totalFarmersCount: 10,
    compliantFarmersCount: 7,
    complianceRatePct: 70,
    totalPlansCount: 12,
    totalPlantedAreaHa: 33.5,
    totalTargetKg: 50000,
    totalRealizedKg: 20000,
    overallConversionRatePct: 40,
    cropRanking: [
      { rankPosition: 2, cropId: "k2", cropName: "Feijão", cropVariety: null, unit: "kg", plansCount: 3, plantedAreaHa: 5, targetKg: 10000, realizedKg: 5000, conversionRatePct: 50, productionSharePct: 25 },
      { rankPosition: 1, cropId: "k1", cropName: "Milho", cropVariety: "Crioulo", unit: "kg", plansCount: 9, plantedAreaHa: 28.5, targetKg: 40000, realizedKg: 15000, conversionRatePct: 37.5, productionSharePct: 75 },
    ],
    communities: [
      { communityId: "c-1", communityName: "Alto da Serra", organizationId: "o-1", organizationName: "Cooperativa Sol", activeFarmersCount: 6, compliantFarmersCount: 4, complianceRatePct: 66.67, plansCount: 7, plantedAreaHa: 20, targetKg: 30000, realizedKg: 12000, conversionRatePct: 40, lastExecutionDate: "2026-05-10" },
      { communityId: "c-2", communityName: "Vale Verde", organizationId: "o-1", organizationName: "Cooperativa Sol", activeFarmersCount: 4, compliantFarmersCount: 3, complianceRatePct: 75, plansCount: 5, plantedAreaHa: 13.5, targetKg: 20000, realizedKg: 8000, conversionRatePct: 40, lastExecutionDate: null },
    ],
    organizations: [],
    ...over,
  };
}

function globalSummary(over: Partial<ManagementSummary> = {}): ManagementSummary {
  return summary({
    scope: "GLOBAL",
    organizationId: null,
    organizationName: null,
    totalOrganizationsCount: 3,
    organizations: [
      { organizationId: "o-1", organizationName: "Cooperativa Sol", communitiesCount: 2, activeFarmersCount: 10, compliantFarmersCount: 7, complianceRatePct: 70, plansCount: 12, plantedAreaHa: 33.5, targetKg: 50000, realizedKg: 20000, conversionRatePct: 40 },
      { organizationId: "o-2", organizationName: "Associação Lua", communitiesCount: 1, activeFarmersCount: 3, compliantFarmersCount: 1, complianceRatePct: 33.33, plansCount: 2, plantedAreaHa: 4, targetKg: 4000, realizedKg: 100, conversionRatePct: 2.5 },
    ],
    ...over,
  });
}

beforeEach(() => {
  vi.mocked(listHarvests).mockResolvedValue([
    { id: "h-old", label: "Safra 2025", startDate: "2025-01-01", endDate: "2025-12-31" },
    { id: "h-1", label: "Safra 2026", startDate: "2026-01-01", endDate: "2026-12-31" },
  ]);
  vi.mocked(listOrganizations).mockResolvedValue([
    { id: "o-1", name: "Cooperativa Sol", taxId: "1", type: "COOP" },
    { id: "o-2", name: "Associação Lua", taxId: "2", type: "ASSOC" },
  ]);
  vi.mocked(listCommunities).mockResolvedValue([
    { id: "c-1", name: "Alto da Serra", organizationId: "o-1" },
    { id: "c-2", name: "Vale Verde", organizationId: "o-1" },
  ] as never);
  vi.mocked(getManagerSummary).mockResolvedValue(summary());
  vi.mocked(getGlobalSummary).mockResolvedValue(globalSummary());
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ManagementDashboard — gestor (UNIT-003)", () => {
  it("consulta só a organização do gestor e mostra as métricas com cabeçalho", async () => {
    render(<ManagementDashboard role="MANAGER" />);
    expect(await screen.findByTestId("mgmt-scope-title")).toHaveProperty("textContent", "Cooperativa Sol");
    expect(screen.getByText("Safra: Safra 2026")).toBeTruthy();
    expect(getGlobalSummary).not.toHaveBeenCalled();
    expect(getManagerSummary).toHaveBeenCalledWith({ harvestId: undefined, communityId: undefined });
    const card = (label: string) => screen.getByText(label).closest("[data-slot=card]") as HTMLElement;
    expect(within(card("Volume previsto")).getByText("50.000 kg")).toBeTruthy();
    expect(within(card("Volume colhido (validado)")).getByText("20.000 kg")).toBeTruthy();
    expect(within(card("Taxa de conversão")).getByText("40%")).toBeTruthy();
    expect(within(card("Agricultores")).getByText("7 em dia (70%)")).toBeTruthy();
    expect(screen.queryByText("Organizações")).toBeNull();
  });

  it("não mostra filtro de organização e nunca chama o global", async () => {
    render(<ManagementDashboard role="MANAGER" />);
    await screen.findByTestId("mgmt-scope-title");
    expect(screen.queryByRole("combobox", { name: "Organização" })).toBeNull();
    expect(screen.getByRole("combobox", { name: "Safra" })).toBeTruthy();
    expect(listOrganizations).not.toHaveBeenCalled();
    await waitFor(() => expect(listCommunities).toHaveBeenCalledWith("o-1"));
  });
});

describe("ManagementDashboard — administrador (UNIT-003)", () => {
  it("consulta o global e mostra 'Todas as organizações' e o total de organizações", async () => {
    render(<ManagementDashboard role="ADMIN" />);
    expect(await screen.findByTestId("mgmt-scope-title")).toHaveProperty("textContent", "Todas as organizações");
    expect(getManagerSummary).not.toHaveBeenCalled();
    expect(getGlobalSummary).toHaveBeenCalledWith({
      harvestId: undefined,
      communityId: undefined,
      organizationId: undefined,
    });
    expect(screen.getByText("Organizações")).toBeTruthy();
  });
});

describe("ManagementDashboard — cabeçalho do admin com organização filtrada (UNIT-003)", () => {
  it("mostra o nome da organização devolvido pelo back no escopo global filtrado", async () => {
    vi.mocked(getGlobalSummary).mockResolvedValue(
      globalSummary({ organizationId: "o-1", organizationName: "Cooperativa Sol" }),
    );
    render(<ManagementDashboard role="ADMIN" />);
    expect(await screen.findByTestId("mgmt-scope-title")).toHaveProperty("textContent", "Cooperativa Sol");
  });
});

describe("ManagementDashboard — blocos (UNIT-004, UNIT-006)", () => {
  it("ranking na ordem de rankPosition com conversão e participação", async () => {
    render(<ManagementDashboard role="MANAGER" />);
    const table = await screen.findByTestId("crop-ranking");
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows[0].textContent).toContain("Milho (Crioulo)");
    expect(rows[0].textContent).toContain("37,5%");
    expect(rows[0].textContent).toContain("75%");
    expect(rows[1].textContent).toContain("Feijão");
    expect(screen.getByTestId("crop-share-chart")).toBeTruthy();
  });

  it("comunidades: gráfico e tabela; sem coluna de organização no escopo da organização", async () => {
    render(<ManagementDashboard role="MANAGER" />);
    const table = await screen.findByTestId("communities-table");
    expect(screen.getByTestId("management-community-chart").textContent).toBe("Alto da Serra,Vale Verde");
    expect(within(table).queryByRole("columnheader", { name: "Organização" })).toBeNull();
    expect(within(table).getByText("Alto da Serra")).toBeTruthy();
    expect(screen.queryByTestId("organizations-table")).toBeNull();
  });

  it("global: tabela de comunidades com organização e comparativo entre organizações", async () => {
    render(<ManagementDashboard role="ADMIN" />);
    const communities = await screen.findByTestId("communities-table");
    expect(within(communities).getByRole("columnheader", { name: "Organização" })).toBeTruthy();
    const orgs = screen.getByTestId("organizations-table");
    expect(within(orgs).getByText("Associação Lua")).toBeTruthy();
    expect(within(orgs).getByText("2,5%")).toBeTruthy();
  });

  it("global com organizations vazio não mostra o comparativo entre organizações", async () => {
    vi.mocked(getGlobalSummary).mockResolvedValue(globalSummary({ organizations: [] }));
    render(<ManagementDashboard role="ADMIN" />);
    await screen.findByTestId("communities-table");
    expect(screen.queryByTestId("organizations-table")).toBeNull();
  });
});

describe("ManagementDashboard — filtros (UNIT-007)", () => {
  it("safra: 'Safra vigente' + safras em ordem decrescente; troca refaz uma consulta", async () => {
    render(<ManagementDashboard role="MANAGER" />);
    await screen.findByTestId("mgmt-scope-title");
    await waitFor(() => expect(listHarvests).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("combobox", { name: "Safra" }));
    const names = (await screen.findAllByRole("option")).map((o) => o.textContent);
    expect(names).toEqual(["Safra vigente", "Safra 2026", "Safra 2025"]);
    fireEvent.keyDown(screen.getAllByRole("option")[0], { key: "Escape" });
    vi.mocked(getManagerSummary).mockClear();
    await choose("Safra", "Safra 2025");
    await waitFor(() =>
      expect(getManagerSummary).toHaveBeenCalledWith({ harvestId: "h-old", communityId: undefined }),
    );
    expect(getManagerSummary).toHaveBeenCalledTimes(1);
  });

  it("gestor filtra por comunidade da sua organização", async () => {
    render(<ManagementDashboard role="MANAGER" />);
    await screen.findByTestId("mgmt-scope-title");
    await waitFor(() => expect(listCommunities).toHaveBeenCalledWith("o-1"));
    await waitFor(() => {
      const trigger = screen.getByRole("combobox", { name: "Comunidade" });
      expect(trigger.hasAttribute("disabled")).toBe(false);
    });
    await choose("Comunidade", "Vale Verde");
    await waitFor(() =>
      expect(getManagerSummary).toHaveBeenLastCalledWith({ harvestId: undefined, communityId: "c-2" }),
    );
  });

  it("admin: comunidade desabilitada até escolher organização; trocar organização limpa a comunidade", async () => {
    render(<ManagementDashboard role="ADMIN" />);
    await screen.findByTestId("mgmt-scope-title");
    await waitFor(() => expect(listOrganizations).toHaveBeenCalled());
    expect(screen.getByRole("combobox", { name: "Comunidade" }).hasAttribute("disabled")).toBe(true);
    expect(listCommunities).not.toHaveBeenCalled();

    await choose("Organização", "Cooperativa Sol");
    await waitFor(() =>
      expect(getGlobalSummary).toHaveBeenLastCalledWith({
        harvestId: undefined,
        organizationId: "o-1",
        communityId: undefined,
      }),
    );
    await waitFor(() => expect(listCommunities).toHaveBeenCalledWith("o-1"));
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Comunidade" }).hasAttribute("disabled")).toBe(false),
    );
    await choose("Comunidade", "Alto da Serra");
    await waitFor(() =>
      expect(getGlobalSummary).toHaveBeenLastCalledWith({
        harvestId: undefined,
        organizationId: "o-1",
        communityId: "c-1",
      }),
    );

    vi.mocked(listCommunities).mockResolvedValue([]);
    await choose("Organização", "Associação Lua");
    await waitFor(() =>
      expect(getGlobalSummary).toHaveBeenLastCalledWith({
        harvestId: undefined,
        organizationId: "o-2",
        communityId: undefined,
      }),
    );
  });

  it("falha ao listar opções não impede o resumo", async () => {
    vi.mocked(listHarvests).mockRejectedValue(new Error("x"));
    vi.mocked(listOrganizations).mockRejectedValue(new Error("x"));
    render(<ManagementDashboard role="ADMIN" />);
    expect(await screen.findByTestId("crop-ranking")).toBeTruthy();
  });

  it("só a última resposta é exibida quando as respostas chegam fora de ordem", async () => {
    let resolveFirst: (v: ManagementSummary) => void = () => {};
    vi.mocked(getManagerSummary)
      .mockReset()
      .mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)))
      .mockResolvedValueOnce(summary({ organizationName: "Segunda resposta" }));
    render(<ManagementDashboard role="MANAGER" />);
    await waitFor(() => expect(getManagerSummary).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(listHarvests).toHaveBeenCalled());
    await choose("Safra", "Safra 2025");
    expect(await screen.findByText("Segunda resposta")).toBeTruthy();
    resolveFirst(summary({ organizationName: "Primeira resposta" }));
    await new Promise((r) => setTimeout(r, 10));
    expect(screen.queryByText("Primeira resposta")).toBeNull();
    expect(screen.getByText("Segunda resposta")).toBeTruthy();
  });
});

describe("ManagementDashboard — estados (UNIT-008)", () => {
  it("carregando mostra skeleton", () => {
    vi.mocked(getManagerSummary).mockReturnValue(new Promise(() => {}));
    render(<ManagementDashboard role="MANAGER" />);
    expect(screen.getByLabelText("Carregando painel")).toBeTruthy();
  });

  it("vazio mostra a explicação e 'Limpar filtros' só com filtro ativo", async () => {
    vi.mocked(getManagerSummary).mockResolvedValue(
      summary({ isEmpty: true, cropRanking: [], communities: [] }),
    );
    render(<ManagementDashboard role="MANAGER" />);
    expect(await screen.findByText("Nenhum plano de produção para este recorte")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).toBeNull();
    await waitFor(() => expect(listHarvests).toHaveBeenCalled());
    await choose("Safra", "Safra 2025");
    const clear = await screen.findByRole("button", { name: "Limpar filtros" });
    vi.mocked(getManagerSummary).mockClear();
    fireEvent.click(clear);
    await waitFor(() =>
      expect(getManagerSummary).toHaveBeenLastCalledWith({ harvestId: undefined, communityId: undefined }),
    );
  });

  it("sem planos na safra (isEmpty false) também mostra o estado vazio", async () => {
    vi.mocked(getManagerSummary).mockResolvedValue(
      summary({ totalPlansCount: 0, cropRanking: [], communities: [] }),
    );
    render(<ManagementDashboard role="MANAGER" />);
    expect(await screen.findByText("Nenhum plano de produção para este recorte")).toBeTruthy();
  });

  it("erro mostra a mensagem do back e 'Tentar novamente' recupera", async () => {
    vi.mocked(getManagerSummary)
      .mockRejectedValueOnce(new ApiError(500, "Falha no servidor", null))
      .mockResolvedValueOnce(summary());
    render(<ManagementDashboard role="MANAGER" />);
    expect((await screen.findByRole("alert")).textContent).toContain("Falha no servidor");
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByTestId("crop-ranking")).toBeTruthy();
  });

  it("primeira consulta falha: comunidade desabilitada até o 'Tentar novamente' funcionar", async () => {
    vi.mocked(getManagerSummary)
      .mockRejectedValueOnce(new ApiError(500, "Falha no servidor", null))
      .mockResolvedValueOnce(summary());
    render(<ManagementDashboard role="MANAGER" />);
    await screen.findByRole("alert");
    expect(screen.getByRole("combobox", { name: "Comunidade" }).hasAttribute("disabled")).toBe(true);
    expect(listCommunities).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(listCommunities).toHaveBeenCalledWith("o-1"));
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Comunidade" }).hasAttribute("disabled")).toBe(false),
    );
  });

  it("403 mostra a mensagem do back", async () => {
    vi.mocked(getManagerSummary).mockRejectedValue(new ApiError(403, "Acesso negado à organização", null));
    render(<ManagementDashboard role="MANAGER" />);
    expect((await screen.findByRole("alert")).textContent).toContain("Acesso negado à organização");
  });

  it("erro que não é ApiError usa a mensagem genérica", async () => {
    vi.mocked(getManagerSummary).mockRejectedValue(new Error("boom"));
    render(<ManagementDashboard role="MANAGER" />);
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Não foi possível carregar o painel de gestão.",
    );
  });

  it("mostra a nota sobre a atualização periódica", async () => {
    render(<ManagementDashboard role="MANAGER" />);
    await screen.findByTestId("crop-ranking");
    expect(screen.getByText(/alguns minutos/)).toBeTruthy();
  });
});

describe("ManagementDashboard — paginação das tabelas (6.3)", () => {
  const crops = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      rankPosition: n - i, // fora de ordem de propósito
      cropId: `k${n - i}`,
      cropName: `Cultura ${String(n - i).padStart(2, "0")}`,
      cropVariety: null,
      unit: "kg",
      plansCount: 1,
      plantedAreaHa: 1,
      targetKg: 100,
      realizedKg: 50,
      conversionRatePct: 50,
      productionSharePct: 5,
    }));
  const communities = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      communityId: `c-${i + 1}`,
      communityName: `Comunidade ${String(i + 1).padStart(2, "0")}`,
      organizationId: "o-1",
      organizationName: "Cooperativa Sol",
      activeFarmersCount: 1,
      compliantFarmersCount: 1,
      complianceRatePct: 100,
      plansCount: 1,
      plantedAreaHa: 1,
      targetKg: 100,
      realizedKg: 50,
      conversionRatePct: 50,
      lastExecutionDate: null,
    }));
  const orgs = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      organizationId: `o-${i + 1}`,
      organizationName: `Organização ${String(i + 1).padStart(2, "0")}`,
      communitiesCount: 1,
      activeFarmersCount: 1,
      compliantFarmersCount: 1,
      complianceRatePct: 100,
      plansCount: 1,
      plantedAreaHa: 1,
      targetKg: 100,
      realizedKg: 50,
      conversionRatePct: 50,
    }));

  const bodyRows = (id: string) =>
    within(screen.getByTestId(id)).getAllByRole("row").slice(1);

  it("ranking: 10 por página, rodapé, próxima página começa no 11º e volta", async () => {
    vi.mocked(getManagerSummary).mockResolvedValue(summary({ cropRanking: crops(25) }));
    render(<ManagementDashboard role="MANAGER" />);
    await screen.findByTestId("crop-ranking");
    let rows = bodyRows("crop-ranking");
    expect(rows).toHaveLength(10);
    expect(rows[0].textContent).toContain("Cultura 01");
    expect(screen.getAllByRole("navigation", { name: "Paginação" })).toHaveLength(2);
    expect(screen.getAllByRole("status")[0].textContent).toBe("Exibindo 1–10 de 25");

    fireEvent.click(screen.getAllByRole("button", { name: "Próxima página" })[0]);
    rows = bodyRows("crop-ranking");
    expect(rows[0].textContent).toContain("11");
    expect(rows[0].textContent).toContain("Cultura 11");
    expect(screen.getAllByRole("status")[0].textContent).toBe("Exibindo 11–20 de 25");

    fireEvent.click(screen.getAllByRole("button", { name: "Próxima página" })[0]);
    expect(bodyRows("crop-ranking")).toHaveLength(5);
    fireEvent.click(screen.getAllByRole("button", { name: "Página anterior" })[0]);
    expect(screen.getAllByRole("status")[0].textContent).toBe("Exibindo 11–20 de 25");
  });

  it("totais, contagens e gráficos usam a lista inteira, não a página", async () => {
    vi.mocked(getManagerSummary).mockResolvedValue(
      summary({ cropRanking: crops(25), communities: communities(12), totalPlansCount: 77 }),
    );
    render(<ManagementDashboard role="MANAGER" />);
    await screen.findByTestId("crop-ranking");
    expect(screen.getByText("77")).toBeTruthy();
    expect(screen.getByTestId("crop-share-chart").textContent?.split(",")).toHaveLength(25);
    expect(screen.getByTestId("management-community-chart").textContent?.split(",")).toHaveLength(12);
  });

  it("comunidades e organizações paginam de forma independente", async () => {
    vi.mocked(getGlobalSummary).mockResolvedValue(
      globalSummary({ communities: communities(12), organizations: orgs(11) }),
    );
    render(<ManagementDashboard role="ADMIN" />);
    await screen.findByTestId("communities-table");
    expect(bodyRows("communities-table")).toHaveLength(10);
    expect(bodyRows("organizations-table")).toHaveLength(10);
    // ordem na tela: ranking, comunidades, organizações
    const nexts = screen.getAllByRole("button", { name: "Próxima página" });
    fireEvent.click(nexts[2]);
    expect(bodyRows("organizations-table")).toHaveLength(1);
    expect(bodyRows("communities-table")).toHaveLength(10);
    fireEvent.click(screen.getAllByRole("button", { name: "Próxima página" })[1]);
    expect(bodyRows("communities-table")).toHaveLength(2);
  });

  it("trocar o filtro volta para a primeira página", async () => {
    vi.mocked(getManagerSummary).mockResolvedValue(summary({ cropRanking: crops(25) }));
    render(<ManagementDashboard role="MANAGER" />);
    await screen.findByTestId("crop-ranking");
    fireEvent.click(screen.getAllByRole("button", { name: "Próxima página" })[0]);
    expect(screen.getAllByRole("status")[0].textContent).toBe("Exibindo 11–20 de 25");
    await waitFor(() => expect(listHarvests).toHaveBeenCalled());
    await choose("Safra", "Safra 2025");
    await waitFor(() =>
      expect(screen.getAllByRole("status")[0].textContent).toBe("Exibindo 1–10 de 25"),
    );
  });

  it("recarregar ('Tentar novamente') volta para a primeira página; lista que encolhe não deixa página vazia", async () => {
    vi.mocked(getManagerSummary)
      .mockReset()
      .mockResolvedValueOnce(summary({ cropRanking: crops(11) }))
      .mockRejectedValueOnce(new ApiError(500, "Falha no servidor", null))
      .mockResolvedValueOnce(summary({ cropRanking: crops(10) }));
    render(<ManagementDashboard role="MANAGER" />);
    await screen.findByTestId("crop-ranking");
    fireEvent.click(screen.getAllByRole("button", { name: "Próxima página" })[0]);
    expect(bodyRows("crop-ranking")).toHaveLength(1);
    await waitFor(() => expect(listHarvests).toHaveBeenCalled());
    await choose("Safra", "Safra 2025");
    fireEvent.click(await screen.findByRole("button", { name: "Tentar novamente" }));
    await screen.findByTestId("crop-ranking");
    expect(bodyRows("crop-ranking")).toHaveLength(10);
    expect(screen.getAllByRole("status")[0].textContent).toBe("Exibindo 1–10 de 10");
  });

  it("'Itens por página' altera o tamanho da página", async () => {
    vi.mocked(getManagerSummary).mockResolvedValue(summary({ cropRanking: crops(25) }));
    render(<ManagementDashboard role="MANAGER" />);
    await screen.findByTestId("crop-ranking");
    // Os ids do seletor repetem entre rodapés; usa o primeiro (ranking).
    const trigger = screen
      .getAllByRole("combobox")
      .find((el) => el.id === "per-page-select") as HTMLElement;
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyUp(trigger, { key: "ArrowDown" });
    const target = await screen.findByRole("option", { name: "20" });
    const options = screen.getAllByRole("option");
    const highlighted = () =>
      options.find((o) => o.getAttribute("data-highlighted") !== null) as HTMLElement;
    for (let i = options.indexOf(highlighted()); i < options.indexOf(target); i += 1) {
      fireEvent.keyDown(highlighted(), { key: "ArrowDown" });
      fireEvent.keyUp(highlighted(), { key: "ArrowDown" });
    }
    fireEvent.keyDown(target, { key: "Enter" });
    fireEvent.keyUp(target, { key: "Enter" });
    await waitFor(() => expect(bodyRows("crop-ranking")).toHaveLength(20));
  });
});
