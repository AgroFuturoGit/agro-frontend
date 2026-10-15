import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { ContinuousHarvestChart } from "@/components/admin/production/harvest-timeline-chart";
import type { Crop } from "@/lib/crops";
import type { ProductionExecution, ProductionPlan } from "@/lib/production";

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
  };
}

const EXECS = [
  exec("a", "2026-05-05", 100),
  exec("b", "2026-05-20", 5),
  exec("c", "2026-06-02", 30, "PENDING"),
];

describe("ContinuousHarvestChart", () => {
  it("UNIT-009: plano CONTINUOUS renderiza o gráfico composto e o alternador troca os períodos", () => {
    render(<ContinuousHarvestChart plan={makePlan()} executions={EXECS} />);

    const chart = screen.getByRole("img");
    expect(chart).toHaveAttribute("data-mode", "composite");
    // 04/05 a 29/06 = 9 semanas → padrão automático Semana.
    expect(chart).toHaveAttribute("data-granularity", "WEEK");
    expect(chart).toHaveAttribute("data-points", "9");

    const week = screen.getByRole("button", { name: "Semana" });
    const month = screen.getByRole("button", { name: "Mês" });
    expect(week).toHaveAttribute("aria-pressed", "true");
    expect(month).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(month);
    expect(screen.getByRole("img")).toHaveAttribute("data-granularity", "MONTH");
    expect(screen.getByRole("img")).toHaveAttribute("data-points", "2");
    expect(screen.getByRole("button", { name: "Mês" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Semana" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("UNIT-010: SINGLE e harvestType nulo renderizam barras simples, sem alternador", () => {
    for (const harvestType of ["SINGLE", null] as const) {
      const { unmount } = render(
        <ContinuousHarvestChart
          plan={makePlan({ crop: { harvestType, unit: "KG" } as Crop })}
          executions={EXECS}
        />,
      );
      expect(screen.getByRole("img")).toHaveAttribute("data-mode", "simple");
      expect(screen.queryByRole("button", { name: "Semana" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Mês" })).toBeNull();
      unmount();
    }
  });

  it("UNIT-011: sem janela mostra só o realizado e o aviso; sem dados mostra o estado vazio", () => {
    const { unmount } = render(
      <ContinuousHarvestChart
        plan={makePlan({ expectedHarvestStart: null, expectedHarvestEnd: null })}
        executions={EXECS}
      />,
    );
    expect(
      screen.getByText(
        "Defina o início e o fim previstos da colheita para ver a curva prevista.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAttribute("data-has-window", "false");
    unmount();

    render(
      <ContinuousHarvestChart
        plan={makePlan({ expectedHarvestStart: null, expectedHarvestEnd: null })}
        executions={[]}
      />,
    );
    expect(
      screen.getByText(
        "Ainda não há dados para o gráfico. Registre um apontamento ou defina a janela de colheita.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("UNIT-012: aria-label resume os valores, legenda e nota aparecem", () => {
    render(
      <ContinuousHarvestChart
        plan={makePlan()}
        executions={[exec("a", "2026-05-05", 105)]}
      />,
    );
    expect(screen.getByRole("img")).toHaveAttribute(
      "aria-label",
      "Previsto 1.800 kg, realizado 105 kg validados e 0 kg pendentes, de 04/05/2026 a 29/06/2026",
    );
    expect(
      screen.getByText("Somente validados contam no realizado oficial."),
    ).toBeInTheDocument();
  });

  it("BR-015: init no mount, setOption por dados/granularidade, resize e dispose no unmount", () => {
    const { unmount } = render(
      <ContinuousHarvestChart plan={makePlan()} executions={EXECS} />,
    );
    expect(echarts.init).toHaveBeenCalledTimes(1);
    expect(echarts.init.mock.calls[0][2]).toEqual({ renderer: "canvas" });
    expect(chart.setOption).toHaveBeenCalledTimes(1);
    const first = chart.setOption.mock.calls[0][0];
    expect(first.xAxis.data).toHaveLength(9);

    fireEvent.click(screen.getByRole("button", { name: "Mês" }));
    expect(echarts.init).toHaveBeenCalledTimes(1);
    expect(chart.setOption).toHaveBeenCalledTimes(2);
    expect(chart.setOption.mock.calls[1][0].xAxis.data).toHaveLength(2);

    resizeCallback?.();
    expect(chart.resize).toHaveBeenCalled();

    unmount();
    expect(chart.dispose).toHaveBeenCalledTimes(1);
  });

  it("estado vazio não inicializa o ECharts", () => {
    render(
      <ContinuousHarvestChart
        plan={makePlan({ expectedHarvestStart: null, expectedHarvestEnd: null })}
        executions={[]}
      />,
    );
    expect(echarts.init).not.toHaveBeenCalled();
  });

  it("BR-012: reaplica a option quando o tema do <html> muda", async () => {
    render(<ContinuousHarvestChart plan={makePlan()} executions={EXECS} />);
    expect(chart.setOption).toHaveBeenCalledTimes(1);
    // Troca de tema no <html> ou em qualquer ancestral do gráfico.
    document.documentElement.classList.add("dark");
    await vi.waitFor(() => expect(chart.setOption).toHaveBeenCalledTimes(2));
    screen.getByRole("img").parentElement!.classList.add("light");
    await vi.waitFor(() => expect(chart.setOption).toHaveBeenCalledTimes(3));
    document.documentElement.classList.remove("dark");
  });
});
