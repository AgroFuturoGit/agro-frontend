import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getFarmerSummary, type FarmerSummary } from "@/lib/analytics";
import { ApiError } from "@/lib/api";
import { getMyProducer } from "@/lib/producers";
import { getProductionComparison, listProductionPlans } from "@/lib/production";

import { CURRENT_HARVEST_TIMEOUT_MS, pickHarvestFilter, ReportsPage } from "./reports-page";

vi.mock("@/lib/analytics", async () => {
  const actual = await vi.importActual<typeof import("@/lib/analytics")>("@/lib/analytics");
  return { ...actual, getFarmerSummary: vi.fn() };
});
vi.mock("@/lib/producers", async () => {
  const actual = await vi.importActual<typeof import("@/lib/producers")>("@/lib/producers");
  return { ...actual, getMyProducer: vi.fn() };
});
vi.mock("@/lib/production", async () => {
  const actual = await vi.importActual<typeof import("@/lib/production")>("@/lib/production");
  return { ...actual, listProductionPlans: vi.fn(), getProductionComparison: vi.fn() };
});

const plan = (id: string, name: string) =>
  ({
    id,
    crop: { name, variety: "Comum" },
    harvest: { label: "2026" },
    expectedYield: 1000,
  }) as never;

// O `Select` do `@base-ui/react` só confirma o item DESTACADO no jsdom (clique
// direto é ignorado): abre pelo teclado e caminha até o alvo, como em
// `farmer-dashboard.test.tsx`.
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
  await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
}

const summaryWith = (currentHarvest: FarmerSummary["currentHarvest"]) =>
  ({ currentHarvest }) as FarmerSummary;

beforeEach(() => {
  vi.mocked(getFarmerSummary).mockResolvedValue(summaryWith(null));
  vi.mocked(getMyProducer).mockResolvedValue({
    id: "f-1",
    community: { id: "com-1", organization: { id: "org-1" } },
  } as never);
  vi.mocked(listProductionPlans).mockResolvedValue([plan("p-1", "Milho"), plan("p-2", "Feijão")]);
  vi.mocked(getProductionComparison).mockImplementation(async (id: string) => {
    if (id === "p-2") throw new Error("x");
    return {
      productionPlanId: id,
      expectedYield: 1000,
      totalActualYield: 400,
      difference: -600,
      percentageRealized: 40,
    };
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ReportsPage", () => {
  it("cabeçalho, consolidado, barra de progresso e 'Ver detalhes' com o link do plano", async () => {
    render(<ReportsPage />);
    expect(screen.getByRole("heading", { level: 2, name: "Relatórios" })).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "Consolidado" })).toBeTruthy();
    expect(screen.getByText("Soma de 1 plano de produção.")).toBeTruthy();
    const bar = screen.getByRole("progressbar", {
      name: "Progresso de Milho — Comum em relação à meta",
    });
    expect(bar.getAttribute("aria-valuenow")).toBe("40");
    const links = screen.getAllByRole("link", { name: /Ver detalhes/ });
    expect(links).toHaveLength(2);
    expect(links[0].getAttribute("href")).toBe(
      "/admin/organizacoes/org-1/comunidades/com-1/produtores/f-1/planos/p-1",
    );
    expect(links[0].textContent).toContain("Safra 2026");
    expect(screen.getByText("Comparativo indisponível.")).toBeTruthy();
    // O texto da barra diz qual número é qual (as barras são decorativas).
    expect(screen.getByText("Realizado 400 kg de 1.000 kg previstos")).toBeTruthy();
  });

  it("rótulo de safra que já começa com 'Safra' não fica duplicado no card", async () => {
    vi.mocked(listProductionPlans).mockResolvedValue([
      { ...(plan("p-1", "Milho") as object), harvest: { label: "Safra 2024/2025" } } as never,
    ]);
    render(<ReportsPage />);
    await screen.findByRole("heading", { name: "Consolidado" });
    expect(screen.getByText("Safra 2024/2025")).toBeTruthy();
    expect(screen.queryByText(/Safra Safra/i)).toBeNull();
    const link = screen.getByRole("link", { name: /Ver detalhes/ });
    expect(link.textContent).toContain("Safra 2024/2025");
    expect(link.textContent).not.toMatch(/safra safra/i);
  });

  it("sem comunidade/organização não mostra 'Ver detalhes' (não leva a rota proibida)", async () => {
    vi.mocked(getMyProducer).mockResolvedValue({ id: "f-1", community: null } as never);
    render(<ReportsPage />);
    await screen.findByRole("heading", { name: "Consolidado" });
    expect(screen.queryByRole("link", { name: /Ver detalhes/ })).toBeNull();
  });

  it("sem planos mostra o vazio com o CTA para os planos", async () => {
    vi.mocked(listProductionPlans).mockResolvedValue([]);
    render(<ReportsPage />);
    const empty = await screen.findByRole("status");
    expect(within(empty).getByText("Nenhum plano de produção para exibir")).toBeTruthy();
    expect(
      within(empty).getByRole("link", { name: "Ir para os meus planos" }).getAttribute("href"),
    ).toBe("/admin/organizacoes/org-1/comunidades/com-1/produtores/f-1");
  });

  it("erro na primeira carga: alerta sem vazio falso, sem 'Erro 500' cru, e 'Tentar novamente' recupera", async () => {
    vi.mocked(getMyProducer)
      .mockRejectedValueOnce(new ApiError(500, "Erro 500", null))
      .mockResolvedValue({
        id: "f-1",
        community: { id: "com-1", organization: { id: "org-1" } },
      } as never);
    render(<ReportsPage />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Não foi possível carregar os relatórios.");
    expect(alert.textContent).not.toContain("Erro 500");
    expect(screen.queryByText("Nenhum plano de produção para exibir")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByRole("heading", { name: "Consolidado" })).toBeTruthy();
    // A11Y-L5-R2-1: o alerta desmonta; o foco vai para o título da página.
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Relatórios" }));
    // A11Y-L6-6: anel de foco opaco, só no teclado.
    expect(document.activeElement).toHaveClass(
      "outline-none",
      "focus-visible:ring-2",
      "focus-visible:ring-ring",
    );
  });

  it("carregando: região nomeada com o skeleton do consolidado, sem vazio nem alerta", () => {
    vi.mocked(getMyProducer).mockReturnValue(new Promise(() => {}));
    render(<ReportsPage />);
    const region = screen.getByRole("region", { name: "Carregando relatórios" });
    expect(region.getAttribute("aria-busy")).toBe("true");
    expect(within(region).getByText("Carregando Previsto")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Consolidado" })).toBeNull();
  });

  it("A11Y-L5-8/9: 'da meta' em 16px; título do card em até 2 linhas e linha do gráfico com title", async () => {
    render(<ReportsPage />);
    await screen.findByRole("heading", { name: "Consolidado" });
    expect(screen.getAllByText("da meta")[0].className).toContain("text-base");
    const titles = screen.getAllByText("Milho — Comum");
    const chartLabel = titles.find((t) => t.getAttribute("title") === "Milho — Comum");
    expect(chartLabel?.className).toContain("truncate");
    expect(titles.some((t) => t.className.includes("line-clamp-2"))).toBe(true);
  });
});

describe("ReportsPage — filtro de safra (RF5)", () => {
  const H_A = { id: "h-a", label: "2026/2027", startDate: "2026-07-01", endDate: "2027-06-30" };
  const H_B = {
    id: "h-b",
    label: "Safra 2025/2026",
    startDate: "2025-07-01",
    endDate: "2026-06-30",
  };
  const YIELDS: Record<string, [number, number]> = {
    "p-1": [1000, 400],
    "p-2": [2000, 1500],
    "p-3": [500, 100],
  };

  const harvestPlan = (id: string, name: string, harvest: typeof H_A | null) =>
    ({ ...(plan(id, name) as object), harvest }) as never;

  beforeEach(() => {
    // Safra B antes da A na lista: a ordem do seletor vem da `startDate`.
    vi.mocked(listProductionPlans).mockResolvedValue([
      harvestPlan("p-2", "Feijão", H_B),
      harvestPlan("p-1", "Milho", H_A),
      harvestPlan("p-3", "Arroz", null),
    ]);
    vi.mocked(getProductionComparison).mockImplementation(async (id: string) => {
      const [expectedYield, totalActualYield] = YIELDS[id];
      return {
        productionPlanId: id,
        expectedYield,
        totalActualYield,
        difference: totalActualYield - expectedYield,
        percentageRealized: (totalActualYield / expectedYield) * 100,
      };
    });
  });

  const trigger = () => screen.getByRole("combobox", { name: "Safra" });
  // O gatilho termina com o ícone "▼" (decorativo).
  const selected = () => trigger().textContent?.replace("▼", "");
  const cardTitles = () =>
    screen
      .getAllByRole("link", { name: /Ver detalhes/ })
      .map((link) => link.textContent?.split(" de ")[1]?.split(",")[0]);
  const consolidated = () =>
    screen.getByRole("heading", { name: "Consolidado" }).closest("section") as HTMLElement;

  it("abre na safra vigente: seletor rotulado 'Safra', opções por safra mais recente e 'Todas' por último", async () => {
    vi.mocked(getFarmerSummary).mockResolvedValue(summaryWith({ ...H_A }));
    render(<ReportsPage />);
    await screen.findByRole("heading", { name: "Consolidado" });
    expect(getFarmerSummary).toHaveBeenCalledWith();
    // Rótulo visível, ligado ao combobox.
    const label = screen.getByText("Safra", { selector: "label" });
    expect(label.getAttribute("for")).toBe(trigger().id);
    expect(selected()).toBe("Safra 2026/2027");
    expect(cardTitles()).toEqual(["Milho — Comum"]);
    expect(screen.getByText("Soma de 1 plano de produção.")).toBeTruthy();

    fireEvent.click(trigger());
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(3));
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Safra 2026/2027",
      "Safra 2025/2026",
      "Todas as safras",
    ]);
  });

  it.each([
    ["a safra vigente é nula", () => vi.mocked(getFarmerSummary).mockResolvedValue(summaryWith(null))],
    [
      "o resumo falha (sem alerta)",
      () => vi.mocked(getFarmerSummary).mockRejectedValue(new ApiError(500, "Erro 500", null)),
    ],
    [
      "nenhum plano pertence à safra vigente",
      () =>
        vi.mocked(getFarmerSummary).mockResolvedValue(
          summaryWith({ id: "h-z", label: "2027/2028", startDate: null, endDate: null }),
        ),
    ],
  ])("abre em 'Todas as safras' quando %s", async (_case, arrange) => {
    arrange();
    render(<ReportsPage />);
    await screen.findByRole("heading", { name: "Consolidado" });
    expect(selected()).toBe("Todas as safras");
    expect(cardTitles()).toEqual(["Feijão — Comum", "Milho — Comum", "Arroz — Comum"]);
    expect(screen.getByText("Soma de 3 planos de produção.")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("trocar a safra filtra cards, barras e totais sem buscar as comparações de novo", async () => {
    vi.mocked(getFarmerSummary).mockResolvedValue(summaryWith({ ...H_A }));
    render(<ReportsPage />);
    await screen.findByRole("heading", { name: "Consolidado" });
    expect(within(consolidated()).getByText("1.000 kg")).toBeTruthy();
    expect(within(consolidated()).getByText("400 kg")).toBeTruthy();
    expect(screen.getByText("Realizado 400 kg de 1.000 kg previstos")).toBeTruthy();
    const comparisonCalls = vi.mocked(getProductionComparison).mock.calls.length;
    expect(comparisonCalls).toBe(3);

    await chooseHarvest("Safra 2025/2026");
    await waitFor(() => expect(cardTitles()).toEqual(["Feijão — Comum"]));
    expect(within(consolidated()).getByText("2.000 kg")).toBeTruthy();
    expect(within(consolidated()).getByText("1.500 kg")).toBeTruthy();
    expect(screen.getByText("Realizado 1.500 kg de 2.000 kg previstos")).toBeTruthy();
    expect(screen.queryByText("Realizado 400 kg de 1.000 kg previstos")).toBeNull();

    await chooseHarvest("Todas as safras");
    await waitFor(() =>
      expect(cardTitles()).toEqual(["Feijão — Comum", "Milho — Comum", "Arroz — Comum"]),
    );
    expect(screen.getByText("Soma de 3 planos de produção.")).toBeTruthy();
    expect(within(consolidated()).getByText("3.500 kg")).toBeTruthy();
    expect(within(consolidated()).getByText("2.000 kg")).toBeTruthy();

    // Nenhuma chamada nova: o filtro roda no cliente.
    expect(getProductionComparison).toHaveBeenCalledTimes(comparisonCalls);
    expect(listProductionPlans).toHaveBeenCalledTimes(1);
    expect(getFarmerSummary).toHaveBeenCalledTimes(1);
  });

  it("resumo pendurado não prende o skeleton: após o limite abre em 'Todas' e ignora a resposta tardia", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      let resolveSummary: (value: FarmerSummary) => void = () => {};
      vi.mocked(getFarmerSummary).mockReturnValue(
        new Promise((resolve) => {
          resolveSummary = resolve;
        }),
      );
      render(<ReportsPage />);
      // Planos e comparações já chegaram; só o resumo está pendente.
      await waitFor(() => expect(getProductionComparison).toHaveBeenCalledTimes(3));
      expect(screen.getByRole("region", { name: "Carregando relatórios" })).toBeTruthy();

      await act(() => vi.advanceTimersByTimeAsync(CURRENT_HARVEST_TIMEOUT_MS));
      expect(await screen.findByRole("heading", { name: "Consolidado" })).toBeTruthy();
      expect(selected()).toBe("Todas as safras");
      expect(cardTitles()).toEqual(["Feijão — Comum", "Milho — Comum", "Arroz — Comum"]);

      // A vigente chega depois: o filtro não muda sozinho.
      await act(async () => {
        resolveSummary(summaryWith({ ...H_A }));
      });
      expect(selected()).toBe("Todas as safras");
      expect(cardTitles()).toHaveLength(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("plano com safra sem id ou sem safra só aparece em 'Todas as safras'", async () => {
    vi.mocked(listProductionPlans).mockResolvedValue([
      harvestPlan("p-1", "Milho", H_A),
      harvestPlan("p-3", "Arroz", null),
      { ...(plan("p-4", "Soja") as object), harvest: { label: "2024" } } as never,
    ]);
    vi.mocked(getProductionComparison).mockRejectedValue(new Error("x"));
    vi.mocked(getFarmerSummary).mockResolvedValue(summaryWith({ ...H_A }));
    render(<ReportsPage />);
    await screen.findByRole("heading", { name: "Por plano de produção" });
    expect(selected()).toBe("Safra 2026/2027");
    expect(cardTitles()).toEqual(["Milho — Comum"]);

    fireEvent.click(trigger());
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(2));
    // Nenhuma opção para a safra sem id ("Safra 2024").
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Safra 2026/2027",
      "Todas as safras",
    ]);
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());

    await chooseHarvest("Todas as safras");
    await waitFor(() =>
      expect(cardTitles()).toEqual(["Milho — Comum", "Arroz — Comum", "Soja — Comum"]),
    );
  });

  it("safras diferentes com o mesmo rótulo ganham o período no seletor", async () => {
    vi.mocked(listProductionPlans).mockResolvedValue([
      harvestPlan("p-1", "Milho", { ...H_A, label: "2026" }),
      harvestPlan("p-2", "Feijão", {
        id: "h-c",
        label: "Safra 2026",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
      }),
    ]);
    render(<ReportsPage />);
    await screen.findByRole("heading", { name: "Consolidado" });
    fireEvent.click(trigger());
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(3));
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Safra 2026 (07/2026 a 06/2027)",
      "Safra 2026 (01/2026 a 12/2026)",
      "Todas as safras",
    ]);
  });

  it("'Tentar novamente' depois de erro na primeira carga abre na safra vigente", async () => {
    vi.mocked(getMyProducer)
      .mockRejectedValueOnce(new ApiError(500, "Erro 500", null))
      .mockResolvedValue({
        id: "f-1",
        community: { id: "com-1", organization: { id: "org-1" } },
      } as never);
    vi.mocked(getFarmerSummary).mockResolvedValue(summaryWith({ ...H_B }));
    render(<ReportsPage />);
    await screen.findByRole("alert");
    expect(screen.queryByRole("combobox", { name: "Safra" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await screen.findByRole("heading", { name: "Consolidado" });
    expect(selected()).toBe("Safra 2025/2026");
    expect(cardTitles()).toEqual(["Feijão — Comum"]);
  });
});

describe("ReportsPage — paginação dos cards (RF4)", () => {
  const H_A = { id: "h-a", label: "2026", startDate: "2026-01-01", endDate: "2026-12-31" };
  const H_B = { id: "h-b", label: "2025", startDate: "2025-01-01", endDate: "2025-12-31" };
  const NAMES = Array.from({ length: 10 }, (_, i) => `Cultura ${i + 1}`);

  beforeEach(() => {
    // 10 planos na safra vigente (A) e 1 na safra B: 11 em "Todas".
    vi.mocked(listProductionPlans).mockResolvedValue([
      ...NAMES.map(
        (name, i) => ({ ...(plan(`p-${i + 1}`, name) as object), harvest: H_A }) as never,
      ),
      { ...(plan("p-b", "Café") as object), harvest: H_B } as never,
    ]);
    vi.mocked(getProductionComparison).mockImplementation(async (id: string) => ({
      productionPlanId: id,
      expectedYield: 1000,
      totalActualYield: 400,
      difference: -600,
      percentageRealized: 40,
    }));
    vi.mocked(getFarmerSummary).mockResolvedValue(summaryWith({ ...H_A }));
  });

  const cardsRegion = () =>
    screen.getByRole("heading", { name: "Por plano de produção" }).closest("section") as HTMLElement;
  const cardTitles = () =>
    within(cardsRegion())
      .getAllByRole("link", { name: /^Ver detalhes/ })
      .map((link) => link.textContent?.split(" de ")[1]?.split(",")[0]);
  const consolidated = () =>
    screen.getByRole("heading", { name: "Consolidado" }).closest("section") as HTMLElement;
  const chartRows = () =>
    screen.getAllByText("Realizado 400 kg de 1.000 kg previstos").length;
  const status = () => within(cardsRegion()).getByRole("status");

  it("10 planos: 9 cards na página 1 e o 10º na página 2; totais e barras não mudam", async () => {
    render(<ReportsPage />);
    await screen.findByRole("heading", { name: "Consolidado" });
    expect(cardTitles()).toEqual(NAMES.slice(0, 9).map((n) => `${n} — Comum`));
    expect(status().textContent).toBe("Exibindo 1–9 de 10");
    expect(within(cardsRegion()).getByText("Página 1 de 2")).toBeTruthy();
    expect(
      within(cardsRegion()).getByRole("navigation", { name: "Paginação dos relatórios" }),
    ).toBeTruthy();
    expect(screen.getByText("Soma de 10 planos de produção.")).toBeTruthy();
    expect(within(consolidated()).getByText("10.000 kg")).toBeTruthy();
    expect(within(consolidated()).getByText("4.000 kg")).toBeTruthy();
    expect(chartRows()).toBe(10);

    fireEvent.click(within(cardsRegion()).getByRole("button", { name: "Próxima página" }));
    await waitFor(() => expect(cardTitles()).toEqual(["Cultura 10 — Comum"]));
    expect(status().textContent).toBe("Exibindo 10–10 de 10");
    expect(within(cardsRegion()).getByText("Página 2 de 2")).toBeTruthy();
    // O consolidado e as barras seguem com a lista filtrada inteira.
    expect(screen.getByText("Soma de 10 planos de produção.")).toBeTruthy();
    expect(within(consolidated()).getByText("10.000 kg")).toBeTruthy();
    expect(within(consolidated()).getByText("4.000 kg")).toBeTruthy();
    expect(chartRows()).toBe(10);
    // Foco na última página: não cai no body.
    expect(document.activeElement).not.toBe(document.body);
  });

  it("trocar a safra volta à página 1", async () => {
    render(<ReportsPage />);
    await screen.findByRole("heading", { name: "Consolidado" });
    fireEvent.click(within(cardsRegion()).getByRole("button", { name: "Próxima página" }));
    await waitFor(() => expect(status().textContent).toBe("Exibindo 10–10 de 10"));

    // "Todas" tem 11 planos: a página 2 continuaria válida sem o reset.
    await chooseHarvest("Todas as safras");
    await waitFor(() => expect(status().textContent).toBe("Exibindo 1–9 de 11"));
    expect(within(cardsRegion()).getByText("Página 1 de 2")).toBeTruthy();
    expect(cardTitles()).toHaveLength(9);
    expect(screen.getByText("Soma de 11 planos de produção.")).toBeTruthy();
  });

  it("com 9 cards ou menos não mostra a barra", async () => {
    render(<ReportsPage />);
    await screen.findByRole("heading", { name: "Consolidado" });
    await chooseHarvest("Safra 2025");
    await waitFor(() => expect(cardTitles()).toEqual(["Café — Comum"]));
    expect(within(cardsRegion()).queryByRole("navigation")).toBeNull();
    expect(within(cardsRegion()).queryByRole("status")).toBeNull();
  });
});

describe("pickHarvestFilter (safra depois de cada carga)", () => {
  const plans = [
    { id: "p-1", harvest: { id: "h-a" } },
    { id: "p-2", harvest: null },
  ] as never[];

  it("primeira carga: vigente com plano; senão 'Todas'", () => {
    expect(pickHarvestFilter(null, plans, "h-a")).toBe("h-a");
    expect(pickHarvestFilter(null, plans, "h-z")).toBe("__all__");
    expect(pickHarvestFilter(null, plans, null)).toBe("__all__");
  });

  it("recarga preserva a escolha que ainda existe nos planos, inclusive 'Todas'", () => {
    expect(pickHarvestFilter("__all__", plans, "h-a")).toBe("__all__");
    expect(pickHarvestFilter("h-a", plans, null)).toBe("h-a");
  });

  it("recarga em que a escolha sumiu recalcula pela vigente", () => {
    expect(pickHarvestFilter("h-old", plans, "h-a")).toBe("h-a");
    expect(pickHarvestFilter("h-old", plans, null)).toBe("__all__");
  });
});
