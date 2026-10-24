import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import {
  buildCommunityTargetOption,
  buildCropShareOption,
  CommunityTargetChart,
  CropShareChart,
  type ShareChartColors,
} from "@/components/admin/dashboard/crop-share-chart";
import type {
  ManagementCommunityPerformance,
  ManagementCropRankingItem,
} from "@/lib/analytics";

const chart = vi.hoisted(() => ({
  setOption: vi.fn(),
  resize: vi.fn(),
  dispose: vi.fn(),
}));
const echarts = vi.hoisted(() => ({ init: vi.fn(), use: vi.fn() }));

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

const COLORS: ShareChartColors = {
  palette: ["a", "b"],
  target: "t",
  realized: "r",
  text: "x",
  grid: "g",
  popover: "po",
  popoverText: "pt",
  background: "bg",
};

function crop(name: string, share: number, over: Partial<ManagementCropRankingItem> = {}): ManagementCropRankingItem {
  return {
    rankPosition: 1,
    cropId: name,
    cropName: name,
    cropVariety: null,
    unit: "kg",
    plansCount: 1,
    plantedAreaHa: 1,
    targetKg: 100,
    realizedKg: share,
    conversionRatePct: share,
    productionSharePct: share,
    ...over,
  };
}

function community(id: string, name: string): ManagementCommunityPerformance {
  return {
    communityId: id,
    communityName: name,
    organizationId: "o",
    organizationName: "Coop",
    activeFarmersCount: 2,
    compliantFarmersCount: 1,
    complianceRatePct: 50,
    plansCount: 2,
    plantedAreaHa: 3,
    targetKg: 1000,
    realizedKg: 400,
    conversionRatePct: 40,
    lastExecutionDate: null,
  };
}

describe("CropShareChart (UNIT-005)", () => {
  it("option: rosca com a participação de cada cultura, sem as de 0%", () => {
    const option = buildCropShareOption(
      [crop("Milho", 60, { cropVariety: "Crioulo" }), crop("Feijão", 40), crop("Soja", 0)],
      COLORS,
    ) as {
      series: { type: string; radius: string[]; data: { name: string; value: number }[] }[];
    };
    expect(option.series[0].type).toBe("pie");
    expect(option.series[0].radius).toHaveLength(2);
    expect(option.series[0].data).toEqual([
      { name: "Milho (Crioulo)", value: 60 },
      { name: "Feijão", value: 40 },
    ]);
  });

  it("renderiza o gráfico e envia a option ao ECharts", () => {
    render(<CropShareChart ranking={[crop("Milho", 100)]} />);
    expect(screen.getByTestId("crop-share-chart")).toBeTruthy();
    expect(echarts.init).toHaveBeenCalledTimes(1);
    expect(chart.setOption).toHaveBeenCalled();
  });

  it("sem colheita (soma 0) mostra a mensagem no lugar do gráfico", () => {
    render(<CropShareChart ranking={[crop("Milho", 0), crop("Feijão", 0)]} />);
    expect(screen.getByText("Ainda não há colheita validada nesta safra")).toBeTruthy();
    expect(screen.queryByTestId("crop-share-chart")).toBeNull();
    expect(echarts.init).not.toHaveBeenCalled();
  });

  it("participação > 0 sem nenhum volume colhido também mostra a mensagem", () => {
    render(<CropShareChart ranking={[crop("Milho", 60, { realizedKg: 0 }), crop("Feijão", 40, { realizedKg: 0 })]} />);
    expect(screen.getByTestId("crop-share-empty")).toBeTruthy();
  });

  it("escapa HTML no tooltip", () => {
    const option = buildCropShareOption([crop("<b>x</b>", 100)], COLORS) as {
      tooltip: { formatter: (p: unknown) => string };
    };
    const html = option.tooltip.formatter({ dataIndex: 0 });
    expect(html).toContain("&lt;b&gt;");
    expect(html).not.toContain("<b>x");
  });
});

describe("CommunityTargetChart (UNIT-006)", () => {
  it("option: barras de meta e colhido por comunidade", () => {
    const option = buildCommunityTargetOption(
      [community("c1", "Serra"), community("c2", "Vale")],
      COLORS,
    ) as {
      xAxis: { data: string[] };
      series: { name: string; data: number[] }[];
    };
    expect(option.xAxis.data).toEqual(["Serra", "Vale"]);
    expect(option.series.map((s) => s.name)).toEqual(["Meta", "Colhido"]);
    expect(option.series[1].data).toEqual([400, 400]);
  });

  it("não renderiza sem comunidades", () => {
    render(<CommunityTargetChart communities={[]} />);
    expect(screen.queryByTestId("management-community-chart")).toBeNull();
  });
});
