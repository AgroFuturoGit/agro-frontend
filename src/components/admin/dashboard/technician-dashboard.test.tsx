import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

import { TechnicianDashboard } from "@/components/admin/dashboard/technician-dashboard";
import {
  getTechnicianSummary,
  type TechnicianFarmerSummary,
  type TechnicianSummary,
  type TechnicianWarning,
} from "@/lib/analytics";
import { ApiError } from "@/lib/api";
import { listCrops } from "@/lib/crops";
import { listHarvests } from "@/lib/harvests";
import { getMyAssignedProducers } from "@/lib/technicians";

vi.mock("@/lib/analytics", () => ({ getTechnicianSummary: vi.fn() }));
vi.mock("@/lib/harvests", async () => {
  const actual = await vi.importActual<typeof import("@/lib/harvests")>("@/lib/harvests");
  return { ...actual, listHarvests: vi.fn() };
});
vi.mock("@/lib/crops", async () => {
  const actual = await vi.importActual<typeof import("@/lib/crops")>("@/lib/crops");
  return { ...actual, listCrops: vi.fn() };
});
vi.mock("@/lib/technicians", async () => {
  const actual = await vi.importActual<typeof import("@/lib/technicians")>("@/lib/technicians");
  return { ...actual, getMyAssignedProducers: vi.fn() };
});
const mobile = vi.hoisted(() => ({ value: false }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => mobile.value }));
vi.mock("@/components/admin/dashboard/community-bar-chart", () => ({
  CommunityBarChart: ({ communities }: { communities: { communityName: string }[] }) => (
    <div data-testid="community-bar-chart">
      {communities.map((c) => c.communityName).join(",")}
    </div>
  ),
}));

// O `Select` do `@base-ui/react` só confirma o item DESTACADO no jsdom: abre
// pelo teclado e caminha até o alvo (mesmo padrão do dashboard do agricultor).
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

function warning(planId: string, over: Partial<TechnicianWarning> = {}): TechnicianWarning {
  return {
    planId,
    farmerId: "f-1",
    farmerName: "Zé da Silva",
    communityId: "c-1",
    communityName: "Alto da Serra",
    cropId: "k-1",
    cropName: "Milho",
    cropVariety: "BRS",
    planStatus: "ACTIVE",
    progressStatus: "DELAYED",
    warningTypes: ["INACTIVE_EXECUTIONS"],
    severity: "MEDIUM",
    message: `Mensagem do back ${planId}`,
    targetKg: 1000,
    realizedKg: 100,
    pendingKg: 0,
    expectedPaceKg: 500,
    completionPct: 10,
    lastExecutionDate: "2026-05-20",
    daysWithoutExecution: 20,
    expectedHarvestStart: null,
    expectedHarvestEnd: null,
    ...over,
  };
}

function farmer(id: string, over: Partial<TechnicianFarmerSummary> = {}): TechnicianFarmerSummary {
  return {
    farmerId: id,
    farmerName: `Agricultor ${id}`,
    communityId: "c-1",
    communityName: "Alto da Serra",
    isCompliant: true,
    plansCount: 3,
    activePlansCount: 2,
    plantedAreaHa: 4.5,
    targetKg: 2000,
    realizedKg: 800,
    pendingKg: 60,
    completionPct: 40,
    lastExecutionDate: "2026-05-20",
    warningsCount: 1,
    ...over,
  };
}

const COMMUNITIES = [
  {
    communityId: "c-1",
    communityName: "Alto da Serra",
    assistedFarmersCount: 2,
    farmersWithPlansCount: 2,
    plansCount: 3,
    plantedAreaHa: 4,
    targetKg: 1000,
    realizedKg: 400,
    pendingKg: 100,
    completionPct: 40,
    warningsCount: 1,
  },
  {
    communityId: "c-2",
    communityName: "Vale Verde",
    assistedFarmersCount: 1,
    farmersWithPlansCount: 1,
    plansCount: 2,
    plantedAreaHa: 2,
    targetKg: 500,
    realizedKg: 0,
    pendingKg: 0,
    completionPct: 0,
    warningsCount: 0,
  },
];

function summary(over: Partial<TechnicianSummary> = {}): TechnicianSummary {
  return {
    technicianId: "t-1",
    technicianName: "Téc",
    currentHarvest: { id: "h-1", label: "Safra 2026", startDate: "2026-01-01", endDate: "2026-12-31" },
    appliedCommunityId: null,
    appliedCropId: null,
    isEmpty: false,
    totalAssistedCommunitiesCount: 2,
    totalAssistedFarmersCount: 3,
    totalPlansCount: 5,
    activePlansCount: 4,
    totalPlantedAreaHa: 6,
    totalTargetKg: 1500,
    totalRealizedKg: 400,
    totalPendingKg: 100,
    pendingExecutionsCount: 7,
    overallCompletionPct: 26.67,
    totalWarningsCount: 3,
    warnings: [
      warning("p-med", { severity: "MEDIUM" }),
      warning("p-high", {
        severity: "HIGH",
        warningTypes: ["LOW_YIELD_RISK", "HARVEST_OVERDUE"],
        daysWithoutExecution: null,
        farmerId: "f-2",
        farmerName: "Maria",
      }),
      warning("p-high2", { severity: "HIGH", farmerName: "João", farmerId: "f-9" }),
    ],
    communities: COMMUNITIES,
    farmers: [farmer("f-1"), farmer("f-2", { isCompliant: false, communityName: "Vale Verde" })],
    ...over,
  };
}

function producer(id: string, org: string, community: string) {
  return { id, community: { id: community, name: "x", organization: { id: org } } };
}

beforeEach(() => {
  vi.mocked(getTechnicianSummary).mockResolvedValue(summary());
  vi.mocked(listHarvests).mockResolvedValue([
    { id: "h-old", label: "Safra 2025", startDate: "2025-01-01", endDate: "2025-12-31" },
    { id: "h-1", label: "Safra 2026", startDate: "2026-01-01", endDate: "2026-12-31" },
  ] as never);
  vi.mocked(listCrops).mockResolvedValue([
    { id: "k-1", name: "Milho" },
    { id: "k-2", name: "Feijão" },
  ] as never);
  vi.mocked(getMyAssignedProducers).mockResolvedValue([
    producer("f-1", "o-1", "c-1"),
    producer("f-2", "o-1", "c-2"),
  ] as never);
});

afterEach(() => {
  mobile.value = false;
  cleanup();
  vi.clearAllMocks();
});

describe("TechnicianDashboard — indicadores (UNIT-003)", () => {
  it("mostra os indicadores macro da carteira, com a contagem de pendentes", async () => {
    render(<TechnicianDashboard />);
    expect(await screen.findByText("Comunidades atendidas")).toBeTruthy();
    expect(screen.getByText("Agricultores assistidos")).toBeTruthy();
    expect(screen.getByText("Planos de produção")).toBeTruthy();
    expect(screen.getByText("4 ativos")).toBeTruthy();
    expect(screen.getByText("6 ha")).toBeTruthy();
    expect(screen.getByText("1.500 kg")).toBeTruthy();
    expect(screen.getByText("Realizado (validado)")).toBeTruthy();
    expect(screen.getByText("400 kg")).toBeTruthy();
    expect(screen.getByText("Pendente de validação")).toBeTruthy();
    expect(screen.getByText("100 kg")).toBeTruthy();
    expect(screen.getByText("7 apontamentos pendentes")).toBeTruthy();
    expect(screen.getByText("26,67%")).toBeTruthy();
    expect(screen.getByText(/apenas apontamentos validados/)).toBeTruthy();
    expect(screen.getByText("Safra: Safra 2026")).toBeTruthy();
  });

  it("a primeira consulta vai sem filtros", async () => {
    render(<TechnicianDashboard />);
    await screen.findByText("Comunidades atendidas");
    expect(getTechnicianSummary).toHaveBeenCalledWith({
      harvestId: undefined,
      communityId: undefined,
      cropId: undefined,
    });
  });
});

describe("TechnicianDashboard — alertas (UNIT-004)", () => {
  it("HIGH vem antes de MEDIUM, mantendo a ordem do back, com rótulos e severidade em texto", async () => {
    render(<TechnicianDashboard />);
    await screen.findByText("Comunidades atendidas");
    const cards = screen.getAllByTestId("warning-card");
    expect(cards.map((c) => c.getAttribute("data-severity"))).toEqual([
      "HIGH",
      "HIGH",
      "MEDIUM",
    ]);
    expect(cards[0].textContent).toContain("Maria");
    expect(cards[1].textContent).toContain("João");
    expect(within(cards[0]).getByText("Severidade Alta")).toBeTruthy();
    expect(within(cards[2]).getByText("Severidade Média")).toBeTruthy();
    expect(within(cards[0]).getByText("Risco de baixa produção")).toBeTruthy();
    expect(within(cards[0]).getByText("Colheita atrasada")).toBeTruthy();
    expect(within(cards[2]).getByText("Sem apontamentos recentes")).toBeTruthy();
    expect(within(cards[0]).getByText("Mensagem do back p-high")).toBeTruthy();
    expect(within(cards[2]).getByText(/20 dias sem apontamento/)).toBeTruthy();
    expect(within(cards[2]).getByText(/Conclusão 10%/)).toBeTruthy();
    expect(screen.getByText("Alertas (3)")).toBeTruthy();
  });

  it("sem alertas mostra 'Nenhum alerta na carteira'", async () => {
    vi.mocked(getTechnicianSummary).mockResolvedValue(
      summary({ warnings: [], totalWarningsCount: 0 }),
    );
    render(<TechnicianDashboard />);
    expect(await screen.findByText("Nenhum alerta na carteira")).toBeTruthy();
    expect(screen.queryByTestId("warning-card")).toBeNull();
  });
});

describe("TechnicianDashboard — link do alerta (UNIT-005)", () => {
  it("leva ao plano com a organização e a comunidade do produtor", async () => {
    render(<TechnicianDashboard />);
    await screen.findByText("Comunidades atendidas");
    await waitFor(() =>
      expect(
        screen
          .getAllByRole("link", { name: /Ver plano/ })
          .some((a) => a.getAttribute("href")?.endsWith("/planos/p-high")),
      ).toBe(true),
    );
    const links = screen.getAllByRole("link", { name: /Ver plano/ });
    const high = links.find((a) => a.getAttribute("href")?.endsWith("/planos/p-high"));
    expect(high?.getAttribute("href")).toBe(
      "/admin/organizacoes/o-1/comunidades/c-2/produtores/f-2/planos/p-high",
    );
    const med = links.find((a) => a.getAttribute("href")?.endsWith("/planos/p-med"));
    expect(med?.getAttribute("href")).toBe(
      "/admin/organizacoes/o-1/comunidades/c-1/produtores/f-1/planos/p-med",
    );
  });

  it("produtor fora da lista: cartão sem link, seção intacta", async () => {
    render(<TechnicianDashboard />);
    await screen.findByText("Comunidades atendidas");
    await waitFor(() => expect(screen.getAllByRole("link").length).toBeGreaterThan(0));
    const joao = screen.getAllByTestId("warning-card").find((c) => c.textContent?.includes("João"));
    expect(joao).toBeTruthy();
    expect(within(joao as HTMLElement).queryByRole("link")).toBeNull();
    expect(screen.getAllByTestId("warning-card")).toHaveLength(3);
  });

  it("falha em getMyAssignedProducers: cartões sem link e o resumo segue", async () => {
    vi.mocked(getMyAssignedProducers).mockRejectedValue(new ApiError(500, "x", null));
    render(<TechnicianDashboard />);
    await screen.findByText("Comunidades atendidas");
    expect(screen.getAllByTestId("warning-card")).toHaveLength(3);
    expect(screen.queryAllByRole("link", { name: /Ver plano/ })).toHaveLength(0);
  });
});

describe("TechnicianDashboard — gráfico e tabela (UNIT-006/007)", () => {
  it("passa as comunidades ao gráfico", async () => {
    render(<TechnicianDashboard />);
    expect((await screen.findByTestId("community-bar-chart")).textContent).toBe(
      "Alto da Serra,Vale Verde",
    );
  });

  it("sem comunidades não mostra a seção do gráfico", async () => {
    vi.mocked(getTechnicianSummary).mockResolvedValue(summary({ communities: [] }));
    render(<TechnicianDashboard />);
    await screen.findByText("Comunidades atendidas");
    expect(screen.queryByTestId("community-bar-chart")).toBeNull();
  });

  it("tabela por agricultor com todas as colunas e o selo de conformidade", async () => {
    render(<TechnicianDashboard />);
    await screen.findByText("Comunidades atendidas");
    for (const name of [
      "Agricultor",
      "Comunidade",
      "Planos (ativos)",
      "Área (ha)",
      "Meta (kg)",
      "Realizado (kg)",
      "Pendente (kg)",
      "% conclusão",
      "Último apontamento",
      "Alertas",
      "Situação",
    ]) {
      expect(screen.getByRole("columnheader", { name })).toBeTruthy();
    }
    const rows = screen.getAllByRole("row");
    const first = rows.find((r) => r.textContent?.includes("Agricultor f-1")) as HTMLElement;
    expect(within(first).getByText("3 (2)")).toBeTruthy();
    expect(within(first).getByText("4,5")).toBeTruthy();
    expect(within(first).getByText("2.000")).toBeTruthy();
    expect(within(first).getByText("20/05/2026")).toBeTruthy();
    expect(within(first).getByText("Em dia")).toBeTruthy();
    const second = rows.find((r) => r.textContent?.includes("Agricultor f-2")) as HTMLElement;
    expect(within(second).getByText("Pendências")).toBeTruthy();
  });
});

function manyFarmers(n: number) {
  return Array.from({ length: n }, (_, i) => farmer(`f${String(i + 1).padStart(2, "0")}`));
}

describe("TechnicianDashboard — paginação da tabela de agricultores", () => {
  it("mostra 10 por página com o rodapé, navega e troca itens por página; totais seguem na lista inteira", async () => {
    vi.mocked(getTechnicianSummary).mockResolvedValue(summary({ farmers: manyFarmers(25) }));
    render(<TechnicianDashboard />);
    await screen.findByText("Comunidades atendidas");
    expect(screen.getByText("Agricultor f01")).toBeTruthy();
    expect(screen.getByText("Agricultor f10")).toBeTruthy();
    expect(screen.queryByText("Agricultor f11")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("Exibindo 1–10 de 25");
    expect(screen.getByText("Agricultores assistidos").parentElement?.textContent).toContain("3");

    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    expect(screen.getByText("Agricultor f11")).toBeTruthy();
    expect(screen.queryByText("Agricultor f01")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("Exibindo 11–20 de 25");

    await choose("Itens por página:", "50");
    expect(screen.getByText("Agricultor f25")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Exibindo 1–25 de 25");
  });

  it("trocar o filtro volta para a primeira página", async () => {
    vi.mocked(getTechnicianSummary).mockResolvedValue(summary({ farmers: manyFarmers(25) }));
    render(<TechnicianDashboard />);
    await screen.findByText("Comunidades atendidas");
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    expect(screen.getByRole("status").textContent).toBe("Exibindo 11–20 de 25");
    await choose("Cultura", "Feijão");
    await waitFor(() =>
      expect(getTechnicianSummary).toHaveBeenLastCalledWith({
        harvestId: undefined,
        communityId: undefined,
        cropId: "k-2",
      }),
    );
    await screen.findByText("Agricultor f01");
    expect(screen.getByRole("status").textContent).toBe("Exibindo 1–10 de 25");
  });

  it("no mobile, 10 cartões por página com o rodapé", async () => {
    mobile.value = true;
    vi.mocked(getTechnicianSummary).mockResolvedValue(summary({ farmers: manyFarmers(12) }));
    render(<TechnicianDashboard />);
    await screen.findByText("Comunidades atendidas");
    expect(screen.getAllByTestId("farmer-card")).toHaveLength(10);
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    expect(screen.getAllByTestId("farmer-card")).toHaveLength(2);
  });
});

describe("TechnicianDashboard — mobile (UNIT-007)", () => {
  it("troca a tabela por cartões de agricultor", async () => {
    mobile.value = true;
    render(<TechnicianDashboard />);
    await screen.findByText("Comunidades atendidas");
    const cards = screen.getAllByTestId("farmer-card");
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText("Em dia")).toBeTruthy();
    expect(within(cards[1]).getByText("Pendências")).toBeTruthy();
    expect(screen.queryByRole("columnheader", { name: "Comunidade" })).toBeNull();
  });
});

describe("TechnicianDashboard — filtros (UNIT-008)", () => {
  it("safras em ordem decrescente de início e culturas vindas de /crops", async () => {
    render(<TechnicianDashboard />);
    await screen.findByText("Comunidades atendidas");
    const harvest = screen.getByRole("combobox", { name: "Safra" });
    harvest.focus();
    fireEvent.keyDown(harvest, { key: "ArrowDown" });
    fireEvent.keyUp(harvest, { key: "ArrowDown" });
    const names = (await screen.findAllByRole("option")).map((o) => o.textContent);
    expect(names).toEqual(["Safra vigente", "Safra 2026", "Safra 2025"]);
  });

  it("trocar cada filtro refaz a consulta com os parâmetros ativos", async () => {
    render(<TechnicianDashboard />);
    await screen.findByText("Comunidades atendidas");

    await choose("Safra", "Safra 2025");
    await waitFor(() =>
      expect(getTechnicianSummary).toHaveBeenLastCalledWith({
        harvestId: "h-old",
        communityId: undefined,
        cropId: undefined,
      }),
    );
    await screen.findByText("Comunidades atendidas");

    await choose("Comunidade", "Vale Verde");
    await waitFor(() =>
      expect(getTechnicianSummary).toHaveBeenLastCalledWith({
        harvestId: "h-old",
        communityId: "c-2",
        cropId: undefined,
      }),
    );
    await screen.findByText("Comunidades atendidas");

    await choose("Cultura", "Feijão");
    await waitFor(() =>
      expect(getTechnicianSummary).toHaveBeenLastCalledWith({
        harvestId: "h-old",
        communityId: "c-2",
        cropId: "k-2",
      }),
    );
  });

  it("as opções de comunidade persistem depois de filtrar (a lista da resposta encolhe)", async () => {
    vi.mocked(getTechnicianSummary).mockImplementation(async (p) =>
      p?.communityId
        ? summary({
            appliedCommunityId: p.communityId,
            communities: [COMMUNITIES[1]],
          })
        : summary(),
    );
    render(<TechnicianDashboard />);
    await screen.findByText("Comunidades atendidas");
    await choose("Comunidade", "Vale Verde");
    await waitFor(() =>
      expect(screen.getByTestId("community-bar-chart").textContent).toBe("Vale Verde"),
    );
    const trigger = screen.getByRole("combobox", { name: "Comunidade" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyUp(trigger, { key: "ArrowDown" });
    const names = (await screen.findAllByRole("option")).map((o) => o.textContent);
    expect(names).toEqual(["Todas", "Alto da Serra", "Vale Verde"]);
  });

  it("trocar a safra com comunidade escolhida renova as opções e volta para 'Todas' se ela sumiu", async () => {
    vi.mocked(getTechnicianSummary).mockImplementation(async (p) => {
      const old = p?.harvestId === "h-old";
      const list = old ? [COMMUNITIES[0]] : COMMUNITIES;
      const chosen = p?.communityId ? list.filter((x) => x.communityId === p.communityId) : list;
      return summary({ communities: chosen });
    });
    render(<TechnicianDashboard />);
    await screen.findByText("Comunidades atendidas");
    await choose("Comunidade", "Vale Verde");
    await waitFor(() =>
      expect(screen.getByTestId("community-bar-chart").textContent).toBe("Vale Verde"),
    );

    await choose("Safra", "Safra 2025");
    await waitFor(() =>
      expect(getTechnicianSummary).toHaveBeenLastCalledWith({
        harvestId: "h-old",
        communityId: undefined,
        cropId: undefined,
      }),
    );
    await waitFor(() =>
      expect(screen.getByTestId("community-bar-chart").textContent).toBe("Alto da Serra"),
    );
    expect(screen.getByRole("combobox", { name: "Comunidade" }).textContent).toContain("Todas");
    const trigger = screen.getByRole("combobox", { name: "Comunidade" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyUp(trigger, { key: "ArrowDown" });
    expect((await screen.findAllByRole("option")).map((o) => o.textContent)).toEqual([
      "Todas",
      "Alto da Serra",
    ]);
  });

  it("trocar a cultura com comunidade escolhida mantém a seleção se ela segue nas opções", async () => {
    vi.mocked(getTechnicianSummary).mockImplementation(async (p) => {
      const chosen = p?.communityId
        ? COMMUNITIES.filter((x) => x.communityId === p.communityId)
        : COMMUNITIES;
      return summary({ communities: chosen });
    });
    render(<TechnicianDashboard />);
    await screen.findByText("Comunidades atendidas");
    await choose("Comunidade", "Vale Verde");
    await waitFor(() =>
      expect(screen.getByTestId("community-bar-chart").textContent).toBe("Vale Verde"),
    );
    await choose("Cultura", "Feijão");
    await waitFor(() =>
      expect(getTechnicianSummary).toHaveBeenCalledWith({
        harvestId: undefined,
        communityId: "c-2",
        cropId: "k-2",
      }),
    );
    expect(getTechnicianSummary).toHaveBeenCalledWith({
      harvestId: undefined,
      communityId: undefined,
      cropId: "k-2",
    });
    await waitFor(() =>
      expect(screen.getByTestId("community-bar-chart").textContent).toBe("Vale Verde"),
    );
    expect(screen.getByRole("combobox", { name: "Comunidade" }).textContent).toContain(
      "Vale Verde",
    );
  });

  it("resposta antiga que chega depois da nova não sobrescreve a tela (corrida)", async () => {
    let resolveFirst: (v: TechnicianSummary) => void = () => {};
    let resolveSecond: (v: TechnicianSummary) => void = () => {};
    vi.mocked(getTechnicianSummary)
      .mockResolvedValueOnce(summary())
      .mockReturnValueOnce(new Promise((r) => (resolveFirst = r)))
      .mockReturnValueOnce(new Promise((r) => (resolveSecond = r)));
    render(<TechnicianDashboard />);
    await screen.findByText("Comunidades atendidas");

    await choose("Safra", "Safra 2025");
    await choose("Cultura", "Feijão");
    await waitFor(() => expect(getTechnicianSummary).toHaveBeenCalledTimes(3));

    resolveSecond(summary({ farmers: [farmer("segundo")] }));
    await screen.findByText("Agricultor segundo");
    resolveFirst(summary({ farmers: [farmer("primeiro")] }));
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByText("Agricultor segundo")).toBeTruthy();
    expect(screen.queryByText("Agricultor primeiro")).toBeNull();
  });

  it("falha em /harvests e /crops não impede o resumo", async () => {
    vi.mocked(listHarvests).mockRejectedValue(new ApiError(500, "x", null));
    vi.mocked(listCrops).mockRejectedValue(new ApiError(500, "x", null));
    render(<TechnicianDashboard />);
    expect(await screen.findByText("Comunidades atendidas")).toBeTruthy();
    const trigger = screen.getByRole("combobox", { name: "Cultura" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyUp(trigger, { key: "ArrowDown" });
    expect((await screen.findAllByRole("option")).map((o) => o.textContent)).toEqual(["Todas"]);
  });
});

describe("TechnicianDashboard — estados (UNIT-009)", () => {
  it("mostra o carregamento enquanto a chamada não resolve", () => {
    vi.mocked(getTechnicianSummary).mockReturnValue(new Promise(() => {}));
    render(<TechnicianDashboard />);
    expect(screen.getByLabelText("Carregando painel")).toBeTruthy();
  });

  it("vazio sem filtro: mensagem e sem botão de limpar", async () => {
    vi.mocked(getTechnicianSummary).mockResolvedValue(
      summary({ isEmpty: true, warnings: [], communities: [], farmers: [] }),
    );
    render(<TechnicianDashboard />);
    expect(await screen.findByText("Nenhum plano na carteira para este recorte")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).toBeNull();
  });

  it("vazio com filtro ativo: 'Limpar filtros' restaura o padrão", async () => {
    vi.mocked(getTechnicianSummary).mockImplementation(async (p) =>
      p?.cropId
        ? summary({ isEmpty: true, warnings: [], communities: [], farmers: [] })
        : summary(),
    );
    render(<TechnicianDashboard />);
    await screen.findByText("Comunidades atendidas");
    await choose("Cultura", "Feijão");
    fireEvent.click(await screen.findByRole("button", { name: "Limpar filtros" }));
    expect(await screen.findByText("Comunidades atendidas")).toBeTruthy();
    expect(getTechnicianSummary).toHaveBeenLastCalledWith({
      harvestId: undefined,
      communityId: undefined,
      cropId: undefined,
    });
  });

  it("erro mostra a mensagem do back e 'Tentar novamente' recupera", async () => {
    vi.mocked(getTechnicianSummary)
      .mockRejectedValueOnce(new ApiError(403, "Técnico inativo.", null))
      .mockResolvedValue(summary());
    render(<TechnicianDashboard />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Técnico inativo.");
    expect(screen.queryByRole("button", { name: "Voltar para Todas" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("Comunidades atendidas")).toBeTruthy();
  });

  it("erro que não é ApiError usa a mensagem genérica", async () => {
    vi.mocked(getTechnicianSummary).mockRejectedValue(new Error("boom"));
    render(<TechnicianDashboard />);
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Não foi possível carregar o resumo da carteira.",
    );
  });

  it("403 de comunidade não assistida mostra a mensagem do back e volta para 'Todas'", async () => {
    vi.mocked(getTechnicianSummary).mockImplementation(async (p) => {
      if (p?.communityId) {
        throw new ApiError(403, "Comunidade não assistida pelo técnico logado.", null);
      }
      return summary();
    });
    render(<TechnicianDashboard />);
    await screen.findByText("Comunidades atendidas");
    await choose("Comunidade", "Vale Verde");
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Comunidade não assistida pelo técnico logado.");
    fireEvent.click(screen.getByRole("button", { name: "Voltar para Todas" }));
    expect(await screen.findByText("Comunidades atendidas")).toBeTruthy();
    expect(getTechnicianSummary).toHaveBeenLastCalledWith({
      harvestId: undefined,
      communityId: undefined,
      cropId: undefined,
    });
  });
});
