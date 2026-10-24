import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import {
  buildCommunityTargetOption,
  CommunityTargetChart,
} from "@/components/admin/dashboard/community-target-chart";
import type { ManagementCommunityPerformance } from "@/lib/analytics";

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

const COLORS = {
  target: "t",
  realized: "r",
  text: "x",
  grid: "g",
  popover: "po",
  popoverText: "pt",
  background: "bg",
};

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
