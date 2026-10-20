import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { FarmerDashboard } from "@/components/admin/dashboard/farmer-dashboard";
import {
  getFarmerSummary,
  type FarmerPlanCard,
  type FarmerSummary,
  type ProgressStatus,
} from "@/lib/analytics";
import { ApiError } from "@/lib/api";
import { listHarvests } from "@/lib/harvests";
import { getMyProducer } from "@/lib/producers";

vi.mock("@/lib/analytics", () => ({ getFarmerSummary: vi.fn() }));
vi.mock("@/lib/harvests", async () => {
  const actual = await vi.importActual<typeof import("@/lib/harvests")>("@/lib/harvests");
  return { ...actual, listHarvests: vi.fn() };
});
vi.mock("@/lib/producers", async () => {
  const actual = await vi.importActual<typeof import("@/lib/producers")>("@/lib/producers");
  return { ...actual, getMyProducer: vi.fn() };
});

function card(planId: string, progressStatus: ProgressStatus, over: Partial<FarmerPlanCard> = {}): FarmerPlanCard {
  return {
    planId,
    cropId: "c",
    cropName: "Milho",
    cropVariety: "BRS",
    harvestType: "SINGLE",
    unit: "KG",
    status: "ACTIVE",
    locationDescription: "Talhão 1",
    plantedAreaHa: 2,
    targetKg: 1000,
    realizedKg: 500,
    pendingKg: 50,
    completionPct: 50,
    progressStatus,
    plantingDate: null,
    expectedHarvestStart: null,
    expectedHarvestEnd: null,
    lastExecutionDate: "2026-05-20",
    ...over,
  };
}

const SUMMARY: FarmerSummary = {
  farmerId: "f-1",
  farmerName: "Zé",
  communityName: "Alto",
  currentHarvest: { id: "h-1", label: "Safra 2026", startDate: "2026-01-01", endDate: "2026-12-31" },
  isEmpty: false,
  totalPlansCount: 5,
  activePlotsCount: 4,
  totalPlantedAreaHa: 10.5,
  totalTargetKg: 5000,
  totalRealizedKg: 2500,
  totalPendingKg: 300,
  overallCompletionPct: 50,
  plans: [
    card("p-ok", "ON_TRACK"),
    card("p-goal", "GOAL_REACHED", { completionPct: 112, realizedKg: 1120 }),
    card("p-below", "BELOW_EXPECTED"),
    card("p-late", "DELAYED"),
    card("p-new", "NOT_STARTED", { completionPct: 0, lastExecutionDate: null }),
  ],
};

beforeEach(() => {
  vi.mocked(getFarmerSummary).mockResolvedValue(SUMMARY);
  vi.mocked(listHarvests).mockResolvedValue([
    { id: "h-0", label: "Safra 2025", startDate: "2025-01-01", endDate: "2025-12-31" },
    { id: "h-1", label: "Safra 2026", startDate: "2026-01-01", endDate: "2026-12-31" },
  ]);
  vi.mocked(getMyProducer).mockResolvedValue({
    id: "f-1",
    community: { id: "com-1", name: "Alto", organization: { id: "org-1" } },
  } as never);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("FarmerDashboard (UNIT-003..006)", () => {
  it("UNIT-003: totais com área, meta, realizado, pendente, % e textos de validado/pendente", async () => {
    render(<FarmerDashboard />);
    expect(await screen.findByText("10,5 ha")).toBeTruthy();
    expect(screen.getByText("5.000 kg")).toBeTruthy();
    expect(screen.getByText("2.500 kg")).toBeTruthy();
    expect(screen.getByText("300 kg")).toBeTruthy();
    expect(screen.getAllByText("50%").length).toBeGreaterThan(0);
    expect(screen.getByText("Talhões ativos")).toBeTruthy();
    expect(screen.getByText(/apenas apontamentos validados/)).toBeTruthy();
    expect(screen.getByText(/aguardam validação/)).toBeTruthy();
    expect(screen.getByText("Safra: Safra 2026")).toBeTruthy();
  });

  it("UNIT-004: cartão com barra limitada a 100%, número real, rótulo e cor por status, e link", async () => {
    render(<FarmerDashboard />);
    const cards = await screen.findAllByTestId("farmer-plan-card");
    expect(cards).toHaveLength(5);
    const expected: [string, string, string][] = [
      ["ON_TRACK", "No ritmo", "bg-green-600"],
      ["GOAL_REACHED", "Meta atingida", "bg-green-600"],
      ["BELOW_EXPECTED", "Abaixo do esperado", "bg-yellow-500"],
      ["DELAYED", "Atrasado", "bg-red-600"],
      ["NOT_STARTED", "Não iniciado", "bg-gray-400"],
    ];
    cards.forEach((el, i) => {
      expect(el.getAttribute("data-progress")).toBe(expected[i][0]);
      expect(el.textContent).toContain(expected[i][1]);
      expect(el.querySelector('[data-testid="progress-fill"]')!.className).toContain(expected[i][2]);
    });
    // 112%: número real, barra em 100%.
    expect(cards[1].textContent).toContain("112%");
    expect((cards[1].querySelector('[data-testid="progress-fill"]') as HTMLElement).style.width).toBe("100%");
    expect(cards[4].textContent).toContain("—");

    await waitFor(() =>
      expect(screen.getAllByRole("link", { name: /Ver plano/ })).toHaveLength(5),
    );
    expect(screen.getAllByRole("link", { name: /Ver plano/ })[0].getAttribute("href")).toBe(
      "/admin/organizacoes/org-1/comunidades/com-1/produtores/f-1/planos/p-ok",
    );
  });

  it("UNIT-004: sem caminho (falha em /farmers/me) o cartão aparece sem link", async () => {
    vi.mocked(getMyProducer).mockRejectedValue(new Error("x"));
    render(<FarmerDashboard />);
    await screen.findAllByTestId("farmer-plan-card");
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("UNIT-005: 'Safra vigente' sem harvestId; trocar refaz a chamada com harvestId; safras em ordem decrescente", async () => {
    render(<FarmerDashboard />);
    await screen.findAllByTestId("farmer-plan-card");
    expect(getFarmerSummary).toHaveBeenLastCalledWith(undefined);

    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(3));
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Safra vigente",
      "Safra 2026",
      "Safra 2025",
    ]);
    fireEvent.change(screen.getByLabelText("Safra"), { target: { value: "h-0" } });
    await waitFor(() => expect(getFarmerSummary).toHaveBeenLastCalledWith("h-0"));
  });

  it("UNIT-005: falha em /harvests não quebra o resumo", async () => {
    vi.mocked(listHarvests).mockRejectedValue(new Error("403"));
    render(<FarmerDashboard />);
    await screen.findAllByTestId("farmer-plan-card");
    expect(screen.getAllByRole("option")).toHaveLength(1);
  });

  it("UNIT-006: estado vazio orienta o próximo passo e linka para os planos", async () => {
    vi.mocked(getFarmerSummary).mockResolvedValue({ ...SUMMARY, isEmpty: true, plans: [] });
    render(<FarmerDashboard />);
    expect(await screen.findByText(/ainda não tem planos de produção/)).toBeTruthy();
    expect(screen.getByText(/fale com o seu técnico/)).toBeTruthy();
    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: "Ir para os meus planos" }).getAttribute("href"),
      ).toBe("/admin/organizacoes/org-1/comunidades/com-1/produtores/f-1/planos"),
    );
  });

  it("UNIT-006: carregando mostra skeleton", () => {
    vi.mocked(getFarmerSummary).mockReturnValue(new Promise(() => {}));
    render(<FarmerDashboard />);
    expect(screen.getByLabelText("Carregando painel")).toBeTruthy();
  });

  it("UNIT-006: erro mostra a mensagem do back e 'Tentar novamente' recupera", async () => {
    vi.mocked(getFarmerSummary)
      .mockRejectedValueOnce(new ApiError(404, "Safra não encontrada.", null))
      .mockResolvedValue(SUMMARY);
    render(<FarmerDashboard />);
    expect((await screen.findByRole("alert")).textContent).toContain("Safra não encontrada.");
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("10,5 ha")).toBeTruthy();
  });
});
