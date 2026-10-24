import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import {
  buildCropShareOption,
  CropShareChart,
  type ShareChartColors,
} from "@/components/admin/dashboard/crop-share-chart";
import type { ManagementCropRankingItem } from "@/lib/analytics";

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
