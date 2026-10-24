import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import {
  buildCommunityChartOption,
  CommunityBarChart,
  type CommunityChartColors,
} from "@/components/admin/dashboard/community-bar-chart";
import type { TechnicianCommunitySummary } from "@/lib/analytics";

const chart = vi.hoisted(() => ({
  setOption: vi.fn(),
  resize: vi.fn(),
  dispose: vi.fn(),
}));
const echarts = vi.hoisted(() => ({ init: vi.fn(), use: vi.fn() }));

// O jsdom não tem canvas: o ECharts é mockado; a option é função pura.
vi.mock("echarts/core", () => echarts);

beforeEach(() => {
  echarts.init.mockReset().mockReturnValue(chart);
  chart.setOption.mockReset();
  chart.dispose.mockReset();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const COLORS: CommunityChartColors = {
  target: "t",
  realized: "r",
  pending: "p",
  text: "x",
  grid: "g",
  popover: "po",
  popoverText: "pt",
};

function community(
  id: string,
  name: string,
  over: Partial<TechnicianCommunitySummary> = {},
): TechnicianCommunitySummary {
  return {
    communityId: id,
    communityName: name,
    assistedFarmersCount: 2,
    farmersWithPlansCount: 2,
    plansCount: 3,
    plantedAreaHa: 4,
    targetKg: 1000,
    realizedKg: 400,
    pendingKg: 100,
    completionPct: 40,
    warningsCount: 1,
    ...over,
  };
}

const LIST = [
  community("c-1", "Alto da Serra"),
  community("c-2", "Vale <b>", { targetKg: 500, realizedKg: 0, pendingKg: 0 }),
];

describe("buildCommunityChartOption (UNIT-006)", () => {
  it("tem três séries (meta, realizado, pendente) e categorias = comunidades", () => {
    const option = buildCommunityChartOption(LIST, COLORS) as {
      xAxis: { data: string[] };
      series: { name: string; type: string; data: number[] }[];
      legend: { data: string[] };
    };
    expect(option.xAxis.data).toEqual(["Alto da Serra", "Vale <b>"]);
    expect(option.series.map((s) => s.name)).toEqual(["Meta", "Realizado", "Pendente"]);
    expect(option.series.every((s) => s.type === "bar")).toBe(true);
    expect(option.series[0].data).toEqual([1000, 500]);
    expect(option.series[1].data).toEqual([400, 0]);
    expect(option.series[2].data).toEqual([100, 0]);
    expect(option.legend.data).toEqual(["Meta", "Realizado", "Pendente"]);
  });

  it("tooltip mostra os três valores e escapa o nome da comunidade", () => {
    const option = buildCommunityChartOption(LIST, COLORS) as {
      tooltip: { formatter: (p: unknown) => string };
    };
    const html = option.tooltip.formatter([{ dataIndex: 1 }]);
    expect(html).toContain("Meta: 500 kg");
    expect(html).toContain("Realizado: 0 kg");
    expect(html).toContain("Pendente: 0 kg");
    expect(html).toContain("Vale &lt;b&gt;");
    expect(html).not.toContain("<b>");
  });
});

describe("CommunityBarChart (UNIT-006)", () => {
  it("renderiza o contêiner com resumo acessível e inicializa o ECharts", () => {
    render(<CommunityBarChart communities={LIST} />);
    const el = screen.getByRole("img");
    expect(el.getAttribute("aria-label")).toContain("Alto da Serra: meta 1.000 kg");
    expect(echarts.init).toHaveBeenCalledTimes(1);
    expect(chart.setOption).toHaveBeenCalled();
  });

  it("sem comunidades não renderiza o gráfico", () => {
    const { container } = render(<CommunityBarChart communities={[]} />);
    expect(container.innerHTML).toBe("");
    expect(echarts.init).not.toHaveBeenCalled();
  });

  it("descarta o gráfico ao desmontar", () => {
    const { unmount } = render(<CommunityBarChart communities={LIST} />);
    unmount();
    expect(chart.dispose).toHaveBeenCalled();
  });
});
