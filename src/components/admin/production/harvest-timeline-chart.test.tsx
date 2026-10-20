import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ContinuousHarvestChart } from "@/components/admin/production/harvest-timeline-chart";
import { getHarvestTimeline, type HarvestTimelineResponse } from "@/lib/analytics";
import { ApiError } from "@/lib/api";
import type { Crop } from "@/lib/crops";
import type { ProductionExecution, ProductionPlan } from "@/lib/production";

vi.mock("@/lib/analytics", () => ({ getHarvestTimeline: vi.fn() }));

const chart = vi.hoisted(() => ({
  setOption: vi.fn(),
  resize: vi.fn(),
  dispose: vi.fn(),
}));
const echarts = vi.hoisted(() => ({
  init: vi.fn(),
  use: vi.fn(),
}));

// O jsdom não tem canvas: o ECharts é mockado; o visual é coberto pelos
// testes da option (função pura) e pela verificação na tela real.
vi.mock("echarts/core", () => echarts);

let resizeCallback: (() => void) | null = null;

beforeEach(() => {
  echarts.init.mockReset().mockReturnValue(chart);
  chart.setOption.mockReset();
  chart.resize.mockReset();
  chart.dispose.mockReset();
  resizeCallback = null;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(cb: () => void) {
        resizeCallback = cb;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function makePlan(overrides: Partial<ProductionPlan> = {}): ProductionPlan {
  return {
    id: "plan-1",
    crop: { harvestType: "CONTINUOUS", unit: "KG" } as Crop,
    harvest: null,
    plantedArea: 1,
    status: "ACTIVE",
    expectedHarvestStart: "2026-05-04",
    expectedHarvestEnd: "2026-06-29",
    expectedProductivity: 1800,
    expectedYield: 1800,
    plannedPlantingDate: null,
    createdAt: null,
    ...overrides,
  };
}

function exec(
  id: string,
  harvestedAt: string | null,
  quantityKg: number,
  status: ProductionExecution["status"] = "VALIDATED",
): ProductionExecution {
  return {
    id,
    productionPlanId: "plan-1",
    quantity: quantityKg,
    quantityKg,
    harvestedAt,
    status,
    notes: null,
    createdAt: null,
    rejectionReason: null,
    validatedBy: null,
    validatedAt: null,
    updatedAt: null,
  };
}

const EXECS = [
  exec("a", "2026-05-05", 100),
  exec("b", "2026-05-20", 5),
  exec("c", "2026-06-02", 30, "PENDING"),
];

function weeks(n: number): HarvestTimelineResponse["points"] {
  return Array.from({ length: n }, (_, i) => ({
    date: `2026-05-${String(4 + i * 7).padStart(2, "0")}`,
    expectedValue: 200,
    actualValue: i === 0 ? 105 : 0,
    pendingValue: i === 4 ? 30 : 0,
  }));
}

function timeline(
  overrides: Partial<HarvestTimelineResponse> = {},
): HarvestTimelineResponse {
  return {
    planId: "plan-1",
    harvestType: "CONTINUOUS",
    granularity: "WEEK",
    unit: "kg",
    points: weeks(9),
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(getHarvestTimeline).mockReset().mockResolvedValue(timeline());
});

async function renderChart(
  plan = makePlan(),
  executions: ProductionExecution[] = EXECS,
) {
  const utils = render(<ContinuousHarvestChart plan={plan} executions={executions} />);
  await waitFor(() => expect(screen.queryByLabelText("Carregando gráfico")).toBeNull());
  return utils;
}

describe("ContinuousHarvestChart", () => {
  it("UNIT-007: abre em WEEK chamando o endpoint e o alternador refaz a chamada com MONTH", async () => {
    await renderChart();
    expect(getHarvestTimeline).toHaveBeenCalledWith("plan-1", "WEEK");

    const chartEl = screen.getByRole("img");
    expect(chartEl).toHaveAttribute("data-mode", "composite");
    expect(chartEl).toHaveAttribute("data-granularity", "WEEK");
    expect(chartEl).toHaveAttribute("data-points", "9");
    expect(screen.getByRole("button", { name: "Semana" })).toHaveAttribute("aria-pressed", "true");

    vi.mocked(getHarvestTimeline).mockResolvedValue(
      timeline({ granularity: "MONTH", points: weeks(2) }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Mês" }));
    await waitFor(() =>
      expect(screen.getByRole("img")).toHaveAttribute("data-granularity", "MONTH"),
    );
    expect(getHarvestTimeline).toHaveBeenLastCalledWith("plan-1", "MONTH");
    expect(screen.getByRole("img")).toHaveAttribute("data-points", "2");
    expect(screen.getByRole("button", { name: "Mês" })).toHaveAttribute("aria-pressed", "true");
  });

  it("UNIT-007: SINGLE e harvestType nulo renderizam barras simples, sem alternador", async () => {
    for (const harvestType of ["SINGLE", null] as const) {
      vi.mocked(getHarvestTimeline).mockResolvedValue(
        timeline({ harvestType: "SINGLE", points: weeks(1) }),
      );
      const { unmount } = await renderChart(
        makePlan({ crop: { harvestType, unit: "KG" } as Crop }),
      );
      expect(screen.getByRole("img")).toHaveAttribute("data-mode", "simple");
      expect(screen.queryByRole("button", { name: "Semana" })).toBeNull();
      unmount();
    }
  });

  it("UNIT-007: sem janela mostra o aviso e sem curva prevista; sem pontos mostra o estado vazio", async () => {
    const noWindow = makePlan({ expectedHarvestStart: null, expectedHarvestEnd: null });
    const { unmount } = await renderChart(noWindow);
    expect(
      screen.getByText("Defina o início e o fim previstos da colheita para ver a curva prevista."),
    ).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAttribute("data-has-window", "false");
    expect(chart.setOption.mock.calls[0][0].series.map((s: { name: string }) => s.name)).not.toContain("Previsto");
    unmount();

    vi.mocked(getHarvestTimeline).mockResolvedValue(timeline({ points: [] }));
    await renderChart(noWindow, []);
    expect(
      screen.getByText("Ainda não há dados para o gráfico. Registre um apontamento ou defina a janela de colheita."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("UNIT-007: com janela válida e meta > 0 a curva prevista aparece", async () => {
    await renderChart();
    expect(chart.setOption.mock.calls[0][0].series.map((s: { name: string }) => s.name)).toContain("Previsto");
    expect(screen.getByRole("img")).toHaveAttribute("data-has-window", "true");
  });

  it("UNIT-008: carregando mostra skeleton; erro mostra a mensagem do back e 'Tentar novamente' recupera", async () => {
    vi.mocked(getHarvestTimeline)
      .mockRejectedValueOnce(new ApiError(500, "Falha na timeline.", null))
      .mockResolvedValue(timeline());
    render(<ContinuousHarvestChart plan={makePlan()} executions={EXECS} />);
    expect(screen.getByLabelText("Carregando gráfico")).toBeInTheDocument();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Falha na timeline.");
    expect(echarts.init).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByRole("img")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("UNIT-008: erro que não é ApiError usa a mensagem genérica", async () => {
    vi.mocked(getHarvestTimeline).mockRejectedValue(new Error("boom"));
    render(<ContinuousHarvestChart plan={makePlan()} executions={EXECS} />);
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Não foi possível carregar o gráfico de colheita.",
    );
  });

  it("UNIT-008: recarrega quando a lista de apontamentos muda", async () => {
    const { rerender } = await renderChart();
    expect(getHarvestTimeline).toHaveBeenCalledTimes(1);

    rerender(
      <ContinuousHarvestChart plan={makePlan()} executions={[...EXECS, exec("d", "2026-06-10", 8)]} />,
    );
    await waitFor(() => expect(getHarvestTimeline).toHaveBeenCalledTimes(2));
  });

  it("UNIT-012: aria-label resume os valores a partir dos pontos da API, legenda e nota aparecem", async () => {
    vi.mocked(getHarvestTimeline).mockResolvedValue(
      timeline({ points: [{ date: "2026-05-04", expectedValue: 1800, actualValue: 105, pendingValue: 0 }] }),
    );
    await renderChart();
    expect(screen.getByRole("img")).toHaveAttribute(
      "aria-label",
      "Previsto 1.800 kg, realizado 105 kg validados e 0 kg pendentes, de 04/05/2026 a 29/06/2026",
    );
    expect(screen.getByText("Somente validados contam no realizado oficial.")).toBeInTheDocument();
  });

  it("BR-015: init no mount, setOption por dados/granularidade, resize e dispose no unmount", async () => {
    const { unmount } = await renderChart();
    expect(echarts.init).toHaveBeenCalledTimes(1);
    expect(echarts.init.mock.calls[0][2]).toEqual({ renderer: "canvas" });
    expect(chart.setOption).toHaveBeenCalledTimes(1);
    expect(chart.setOption.mock.calls[0][0].xAxis.data).toHaveLength(9);

    vi.mocked(getHarvestTimeline).mockResolvedValue(timeline({ granularity: "MONTH", points: weeks(2) }));
    fireEvent.click(screen.getByRole("button", { name: "Mês" }));
    await waitFor(() => expect(chart.setOption.mock.calls.at(-1)?.[0].xAxis.data).toHaveLength(2));
    expect(echarts.init).toHaveBeenCalledTimes(1);

    resizeCallback?.();
    expect(chart.resize).toHaveBeenCalled();

    unmount();
    expect(chart.dispose).toHaveBeenCalledTimes(1);
  });

  it("CR-001: ao estreitar o contêiner, recalcula a option e liga o dataZoom", async () => {
    let width = 800;
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => width);
    await renderChart();
    const base = chart.setOption.mock.calls.length;
    expect(chart.setOption.mock.calls[base - 1][0].dataZoom).toBeUndefined();

    width = 790;
    act(() => resizeCallback?.());
    expect(chart.setOption).toHaveBeenCalledTimes(base);

    width = 200;
    act(() => resizeCallback?.());
    expect(chart.setOption).toHaveBeenCalledTimes(base + 1);
    const zoom = chart.setOption.mock.calls[base][0].dataZoom;
    expect(zoom.map((d: { type: string }) => d.type)).toEqual(["inside", "slider"]);
  });

  it("estado vazio não inicializa o ECharts", async () => {
    vi.mocked(getHarvestTimeline).mockResolvedValue(timeline({ points: [] }));
    await renderChart(makePlan({ expectedHarvestStart: null, expectedHarvestEnd: null }), []);
    expect(echarts.init).not.toHaveBeenCalled();
  });

  it("BR-012: reaplica a option quando o tema do <html> muda", async () => {
    await renderChart();
    const base = chart.setOption.mock.calls.length;
    document.documentElement.classList.add("dark");
    await vi.waitFor(() => expect(chart.setOption).toHaveBeenCalledTimes(base + 1));
    screen.getByRole("img").parentElement!.classList.add("light");
    await vi.waitFor(() => expect(chart.setOption).toHaveBeenCalledTimes(base + 2));
    document.documentElement.classList.remove("dark");
  });
});
