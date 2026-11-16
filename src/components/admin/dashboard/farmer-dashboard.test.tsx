import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { FarmerDashboard } from "@/components/admin/dashboard/farmer-dashboard";
import {
  exportFarmerSummary,
  getFarmerSummary,
  type FarmerPlanCard,
  type FarmerSummary,
  type ProgressStatus,
} from "@/lib/analytics";
import { ApiError } from "@/lib/api";
import { listHarvests } from "@/lib/harvests";
import { getMyProducer } from "@/lib/producers";

vi.mock("@/lib/analytics", () => ({ getFarmerSummary: vi.fn(), exportFarmerSummary: vi.fn() }));
vi.mock("@/lib/download", () => ({ saveBlob: vi.fn() }));
vi.mock("@/lib/harvests", async () => {
  const actual = await vi.importActual<typeof import("@/lib/harvests")>("@/lib/harvests");
  return { ...actual, listHarvests: vi.fn() };
});
vi.mock("@/lib/producers", async () => {
  const actual = await vi.importActual<typeof import("@/lib/producers")>("@/lib/producers");
  return { ...actual, getMyProducer: vi.fn() };
});

// O `Select` do `@base-ui/react` só confirma o item DESTACADO no jsdom (clique
// direto é ignorado): abre pelo teclado e caminha até o alvo, como em
// `data-table-pagination.test.tsx`.
async function chooseHarvest(label: string) {
  const trigger = screen.getByRole("combobox", { name: "Safra" });
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
    // UX-L5-R2-01: o rótulo já começa com "Safra", então não repete o prefixo.
    expect(screen.getByTestId("dashboard-toolbar-description").textContent).toBe("Safra 2026");
  });

  it("UX-L5-R2-01: rótulo sem 'Safra' ganha o prefixo uma vez só", async () => {
    vi.mocked(getFarmerSummary).mockResolvedValue({
      ...SUMMARY,
      currentHarvest: { ...SUMMARY.currentHarvest!, label: "2026/27" },
    });
    render(<FarmerDashboard />);

    await screen.findAllByTestId("farmer-plan-card");
    expect(screen.getByTestId("dashboard-toolbar-description").textContent).toBe("Safra 2026/27");
    expect(screen.queryByText(/Safra: /)).toBeNull();
  });

  it("G-4: safra sem rótulo aparece como 'Safra —' na toolbar", async () => {
    vi.mocked(getFarmerSummary).mockResolvedValue({
      ...SUMMARY,
      currentHarvest: { ...SUMMARY.currentHarvest!, label: "" },
    });
    render(<FarmerDashboard />);

    await screen.findAllByTestId("farmer-plan-card");
    expect(screen.getByTestId("dashboard-toolbar-description").textContent).toBe("Safra —");
  });

  it("UNIT-004: cartão com barra limitada a 100%, número real, rótulo e cor por status, e link", async () => {
    render(<FarmerDashboard />);
    const cards = await screen.findAllByTestId("farmer-plan-card");
    expect(cards).toHaveLength(5);
    const expected: [string, string, string][] = [
      ["ON_TRACK", "No ritmo", "success"],
      ["GOAL_REACHED", "Meta atingida", "success"],
      ["BELOW_EXPECTED", "Abaixo do esperado", "warning"],
      ["DELAYED", "Atrasado", "destructive"],
      ["NOT_STARTED", "Não iniciado", "muted"],
    ];
    cards.forEach((el, i) => {
      expect(el.getAttribute("data-progress")).toBe(expected[i][0]);
      expect(el.textContent).toContain(expected[i][1]);
      expect(el.querySelector('[data-testid="progress-fill"]')!.getAttribute("data-variant")).toBe(expected[i][2]);
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

    await waitFor(() => expect(listHarvests).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("combobox", { name: "Safra" }));
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(3));
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Safra vigente",
      "Safra 2026",
      "Safra 2025",
    ]);
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });
    await chooseHarvest("Safra 2025");
    await waitFor(() => expect(getFarmerSummary).toHaveBeenLastCalledWith("h-0"));
  });

  it("CR-001: resposta atrasada da safra anterior não sobrescreve a da safra escolhida depois", async () => {
    let resolveOld: (value: FarmerSummary) => void = () => {};
    vi.mocked(getFarmerSummary)
      .mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; }))
      .mockResolvedValueOnce({ ...SUMMARY, totalPlantedAreaHa: 99 });
    render(<FarmerDashboard />);
    await waitFor(() => expect(listHarvests).toHaveBeenCalled());

    await chooseHarvest("Safra 2025");
    expect(await screen.findByText("99 ha")).toBeTruthy();

    resolveOld(SUMMARY);
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByText("99 ha")).toBeTruthy();
    expect(screen.queryByText("10,5 ha")).toBeNull();
  });

  it("UNIT-005: falha em /harvests não quebra o resumo", async () => {
    vi.mocked(listHarvests).mockRejectedValue(new Error("403"));
    render(<FarmerDashboard />);
    await screen.findAllByTestId("farmer-plan-card");
    fireEvent.click(screen.getByRole("combobox", { name: "Safra" }));
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(1));
  });

  it("UNIT-006: estado vazio orienta o próximo passo e linka para os planos", async () => {
    vi.mocked(getFarmerSummary).mockResolvedValue({ ...SUMMARY, isEmpty: true, plans: [] });
    render(<FarmerDashboard />);
    expect(await screen.findByText(/ainda não tem planos de produção/)).toBeTruthy();
    expect(screen.getByText(/fale com o seu técnico/)).toBeTruthy();
    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: "Ir para os meus planos" }).getAttribute("href"),
      ).toBe("/admin/organizacoes/org-1/comunidades/com-1/produtores/f-1"),
    );
  });

  it("A11Y-L5-R2-1: 'Tentar novamente' leva o foco ao seletor de safra, não ao body", async () => {
    vi.mocked(getFarmerSummary)
      .mockRejectedValueOnce(new ApiError(500, "Erro 500", null))
      .mockResolvedValue(SUMMARY);
    render(<FarmerDashboard />);
    const retry = await screen.findByRole("button", { name: "Tentar novamente" });
    retry.focus();
    fireEvent.click(retry);
    expect(await screen.findByText("10,5 ha")).toBeTruthy();
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(screen.getByRole("combobox", { name: "Safra" }));
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

async function exportAs(name: string) {
  const trigger = screen.getByRole("button", { name: "Exportar relatório" });
  fireEvent.click(trigger);
  fireEvent.click(await screen.findByRole("menuitem", { name }));
}

describe("FarmerDashboard — exportação (AC-005)", () => {
  it("exporta a safra vigente sem filtro e, depois, a safra escolhida", async () => {
    vi.mocked(exportFarmerSummary).mockResolvedValue({ blob: new Blob(["x"]), filename: "r.pdf" });
    render(<FarmerDashboard />);
    await screen.findByText("10,5 ha");

    await exportAs("PDF");
    await waitFor(() => expect(exportFarmerSummary).toHaveBeenLastCalledWith("pdf", undefined));

    await chooseHarvest("Safra 2025");
    await waitFor(() => expect(getFarmerSummary).toHaveBeenLastCalledWith("h-0"));
    await screen.findByText("10,5 ha");
    await exportAs("Excel (.xlsx)");
    await waitFor(() => expect(exportFarmerSummary).toHaveBeenLastCalledWith("xlsx", "h-0"));
  });

  it("fica desabilitado quando o painel está em erro", async () => {
    vi.mocked(getFarmerSummary).mockRejectedValue(new ApiError(500, "falhou", null));
    render(<FarmerDashboard />);
    await screen.findByText("falhou");
    const trigger = screen.getByRole("button", { name: "Exportar relatório" });
    expect(trigger.hasAttribute("disabled") || trigger.hasAttribute("data-disabled")).toBe(true);
  });
});

describe("FarmerDashboard — revisão r1 do lote 5", () => {
  it("A11Y-L5-1: 'Ver plano' com anel de foco opaco e offset (sem ring-ring/50)", async () => {
    render(<FarmerDashboard />);
    const [link] = await screen.findAllByRole("link", { name: /Ver plano/ });
    expect(link).toHaveClass(
      "focus-visible:ring-2",
      "focus-visible:ring-ring",
      "focus-visible:ring-offset-2",
      "focus-visible:ring-offset-card",
    );
    expect(link.className).not.toMatch(/ring-ring\/50/);
  });

  it("UX-L5-03: vazio numa safra antiga oferece 'Voltar para a safra vigente'", async () => {
    vi.mocked(getFarmerSummary).mockResolvedValue({ ...SUMMARY, isEmpty: true, plans: [] });
    render(<FarmerDashboard />);
    await screen.findByText(/ainda não tem planos de produção/);
    await waitFor(() => expect(listHarvests).toHaveBeenCalled());
    await chooseHarvest("Safra 2025");
    expect(await screen.findByText("Nenhum plano nesta safra")).toBeTruthy();
    expect(screen.queryByText(/ainda não tem planos de produção/)).toBeNull();
    vi.mocked(getFarmerSummary).mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Voltar para a safra vigente" }));
    // A11Y-L5-R2-1: o botão desmonta; o foco vai para o seletor de safra.
    expect(document.activeElement).toBe(screen.getByRole("combobox", { name: "Safra" }));
    await waitFor(() => expect(getFarmerSummary).toHaveBeenLastCalledWith(undefined));
  });

  it("UX-L5-05: barra com título do recorte e a safra em texto secundário", async () => {
    render(<FarmerDashboard />);
    await screen.findAllByTestId("farmer-plan-card");
    const bar = screen.getByTestId("dashboard-toolbar");
    expect(bar.textContent).toContain("Minha produção");
    expect(screen.getByTestId("dashboard-toolbar-description").className).toContain("text-muted-foreground");
  });

  it("A11Y-L5-5: o skeleton é uma região nomeada", () => {
    vi.mocked(getFarmerSummary).mockReturnValue(new Promise(() => {}));
    render(<FarmerDashboard />);
    expect(screen.getByRole("region", { name: "Carregando painel" })).toBeTruthy();
  });

  it("'Erro 500' cru vira a mensagem padrão do painel", async () => {
    vi.mocked(getFarmerSummary).mockRejectedValue(new ApiError(500, "Erro 500", null));
    render(<FarmerDashboard />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).not.toContain("Erro 500");
    expect(alert.textContent).toContain("Não foi possível carregar o resumo da sua safra.");
  });
});

describe("FarmerDashboard — paginação dos cartões de plano", () => {
  const manyCards = (n: number) =>
    Array.from({ length: n }, (_, i) => card(`p-${String(i + 1).padStart(2, "0")}`, "ON_TRACK"));
  const pager = () => screen.queryByRole("navigation", { name: "Paginação dos planos" });

  it("10 planos produzem 2 páginas (9 + 1)", async () => {
    vi.mocked(getFarmerSummary).mockResolvedValue({ ...SUMMARY, plans: manyCards(10) });
    render(<FarmerDashboard />);
    expect(await screen.findAllByTestId("farmer-plan-card")).toHaveLength(9);
    expect(screen.getByRole("status").textContent).toBe("Exibindo 1–9 de 10");
    expect(screen.getByText("Página 1 de 2")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    expect(screen.getAllByTestId("farmer-plan-card")).toHaveLength(1);
    expect(screen.getByRole("status").textContent).toBe("Exibindo 10–10 de 10");
    expect(screen.getByText("Página 2 de 2")).toBeTruthy();
  });

  it("na última página o foco vai para 'Página 2 de 2', não para o body", async () => {
    vi.mocked(getFarmerSummary).mockResolvedValue({ ...SUMMARY, plans: manyCards(10) });
    render(<FarmerDashboard />);
    await screen.findAllByTestId("farmer-plan-card");
    const next = screen.getByRole("button", { name: "Próxima página" }) as HTMLButtonElement;
    next.focus();
    fireEvent.click(next);
    const label = within(pager()!).getByText("Página 2 de 2", { exact: true });
    expect(next.disabled).toBe(true);
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(label);
  });

  it("'Voltar para a safra vigente' volta para a página 1", async () => {
    vi.mocked(getFarmerSummary).mockImplementation(async (harvestId?: string) =>
      harvestId
        ? { ...SUMMARY, isEmpty: true, plans: [] }
        : { ...SUMMARY, plans: manyCards(10) },
    );
    render(<FarmerDashboard />);
    await screen.findAllByTestId("farmer-plan-card");
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    expect(screen.getByText("Página 2 de 2")).toBeTruthy();

    await waitFor(() => expect(listHarvests).toHaveBeenCalled());
    await chooseHarvest("Safra 2025");
    fireEvent.click(await screen.findByRole("button", { name: "Voltar para a safra vigente" }));
    await waitFor(() => expect(getFarmerSummary).toHaveBeenLastCalledWith(undefined));
    expect(await screen.findByText("Página 1 de 2")).toBeTruthy();
    expect(screen.getAllByTestId("farmer-plan-card")).toHaveLength(9);
    expect(screen.getByRole("status").textContent).toBe("Exibindo 1–9 de 10");
  });

  it("9 planos ou menos ficam sem barra", async () => {
    vi.mocked(getFarmerSummary).mockResolvedValue({ ...SUMMARY, plans: manyCards(9) });
    render(<FarmerDashboard />);
    expect(await screen.findAllByTestId("farmer-plan-card")).toHaveLength(9);
    expect(pager()).toBeNull();
  });

  it("trocar a safra volta para a página 1", async () => {
    vi.mocked(getFarmerSummary).mockResolvedValue({ ...SUMMARY, plans: manyCards(10) });
    render(<FarmerDashboard />);
    await screen.findAllByTestId("farmer-plan-card");
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    expect(screen.getByText("Página 2 de 2")).toBeTruthy();

    await waitFor(() => expect(listHarvests).toHaveBeenCalled());
    await chooseHarvest("Safra 2025");
    await waitFor(() => expect(getFarmerSummary).toHaveBeenLastCalledWith("h-0"));
    expect(await screen.findByText("Página 1 de 2")).toBeTruthy();
    expect(screen.getAllByTestId("farmer-plan-card")).toHaveLength(9);
    expect(screen.getByRole("status").textContent).toBe("Exibindo 1–9 de 10");
  });
});
