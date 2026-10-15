import { describe, expect, it } from "vitest";

import {
  buildChartSummary,
  buildHarvestChartOption,
  MIN_POINT_WIDTH,
  type ChartColors,
} from "@/components/admin/production/harvest-timeline-option";
import type { HarvestTimeline, TimelinePoint } from "@/lib/harvest-timeline";

const COLORS: ChartColors = {
  validated: "rgb(1, 2, 3)",
  pending: "rgba(1, 2, 3, 0.35)",
  expected: "rgb(9, 9, 9)",
  text: "rgb(5, 5, 5)",
  grid: "rgb(6, 6, 6)",
  popover: "rgb(7, 7, 7)",
  popoverText: "rgb(8, 8, 8)",
};

function point(date: string, expected: number | null, actual = 0, pending = 0): TimelinePoint {
  return { date, expectedValue: expected, actualValue: actual, pendingValue: pending };
}

function timeline(over: Partial<HarvestTimeline> = {}): HarvestTimeline {
  return {
    harvestType: "CONTINUOUS",
    granularity: "WEEK",
    unit: "kg",
    hasExpectedWindow: true,
    points: [
      point("2026-05-04", 221.05, 105, 0),
      point("2026-05-11", 225, 0, 0),
      point("2026-05-18", 225, 5, 40),
    ],
    ...over,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyOption = any;

function build(tl: HarvestTimeline, opts: { width?: number; expectedYield?: number; ariaLabel?: string } = {}): AnyOption {
  return buildHarvestChartOption(tl, COLORS, { expectedYield: 1800, ...opts });
}

describe("buildHarvestChartOption", () => {
  it("UNIT-009: modo composto tem barras empilhadas e linha do previsto", () => {
    const option = build(timeline());
    const series = option.series as AnyOption[];
    expect(series.map((s) => [s.name, s.type, s.stack])).toEqual([
      ["Validado", "bar", "actual"],
      ["Pendente", "bar", "actual"],
      ["Previsto", "line", undefined],
    ]);
    expect(series[0].data).toEqual([105, 0, 5]);
    expect(series[1].data).toEqual([0, 0, 40]);
    expect(series[2].data).toEqual([221.05, 225, 225]);
    expect(option.xAxis.data).toEqual(["04/05", "11/05", "18/05"]);
    expect(option.legend.data).toEqual(["Previsto", "Validado", "Pendente"]);
  });

  it("UNIT-009: granularidade mensal usa rótulos de mês", () => {
    const option = build(
      timeline({
        granularity: "MONTH",
        points: [point("2026-05-01", 900), point("2026-06-01", 900)],
      }),
    );
    expect(option.xAxis.data).toEqual(["Mai/26", "Jun/26"]);
  });

  it("UNIT-011: sem janela não há série de previsto", () => {
    const option = build(timeline({ hasExpectedWindow: false, points: [point("2026-05-04", null, 10)] }));
    expect((option.series as AnyOption[]).map((s) => s.name)).toEqual(["Validado", "Pendente"]);
    expect(option.legend.data).toEqual(["Validado", "Pendente"]);
  });

  it("UNIT-010: colheita única usa duas categorias, sem dataZoom", () => {
    const tl = timeline({
      harvestType: "SINGLE",
      points: [point("2026-05-04", 0, 100, 30), point("2026-05-11", 0, 20, 0)],
    });
    const option = build(tl, { expectedYield: 1800, width: 100 });
    expect(option.xAxis.data).toEqual(["Previsto", "Realizado"]);
    const series = option.series as AnyOption[];
    expect(series.every((s) => s.type === "bar" && s.stack === "total")).toBe(true);
    const byName = Object.fromEntries(series.map((s) => [s.name, s.data]));
    expect(byName["Previsto"]).toEqual([1800, null]);
    expect(byName["Validado"]).toEqual([null, 120]);
    expect(byName["Pendente"]).toEqual([null, 30]);
    expect(option.dataZoom).toBeUndefined();
  });

  it("CR-006: colheita única sem meta mostra só o Realizado, sem barra nem legenda de Previsto", () => {
    const tl = timeline({
      harvestType: "SINGLE",
      hasExpectedWindow: false,
      points: [point("2026-05-04", null, 100, 30)],
    });
    const option = build(tl, { expectedYield: 0 });
    expect(option.xAxis.data).toEqual(["Realizado"]);
    const series = option.series as AnyOption[];
    expect(series.map((s) => s.name)).toEqual(["Validado", "Pendente"]);
    expect(series[0].data).toEqual([100]);
    expect(series[1].data).toEqual([30]);
    expect(option.legend.data).toEqual(["Validado", "Pendente"]);
  });

  it("UNIT-014: dataZoom inside+slider só quando há mais pontos do que cabem; janela final", () => {
    const points = Array.from({ length: 30 }, (_, i) =>
      point(`2026-${String(1 + Math.floor(i / 4)).padStart(2, "0")}-${String(1 + (i % 4) * 7).padStart(2, "0")}`, 10),
    );
    const width = 480; // 10 pontos
    const option = build(timeline({ points }), { width });
    const capacity = Math.floor(width / MIN_POINT_WIDTH);
    expect(option.dataZoom.map((d: AnyOption) => d.type)).toEqual(["inside", "slider"]);
    for (const d of option.dataZoom) {
      expect(d.startValue).toBe(30 - capacity);
      expect(d.endValue).toBe(29);
      expect(d.filterMode).toBe("none");
      expect(d.xAxisIndex).toBe(0);
      expect(d.yAxisIndex).toBeUndefined();
    }

    const fits = build(timeline(), { width: 800 });
    expect(fits.dataZoom).toBeUndefined();
  });

  it("UNIT-012: cores vêm só do parâmetro (tokens resolvidos) e aria habilitado", () => {
    const option = build(timeline());
    const series = option.series as AnyOption[];
    expect(series[0].itemStyle.color).toBe(COLORS.validated);
    expect(series[1].itemStyle.color).toBe(COLORS.pending);
    expect(series[2].lineStyle.color).toBe(COLORS.expected);
    expect(option.tooltip.backgroundColor).toBe(COLORS.popover);
    expect(option.tooltip.textStyle.color).toBe(COLORS.popoverText);
    expect(option.xAxis.axisLabel.color).toBe(COLORS.text);
    expect(option.yAxis.splitLine.lineStyle.color).toBe(COLORS.grid);
    expect(option.aria.enabled).toBe(true);
    const withLabel = build(timeline(), { ariaLabel: "Resumo" });
    expect(withLabel.aria.label.description).toBe("Resumo");
  });

  it("AC-011: tooltip mostra período por extenso e valores exatos em kg", () => {
    const option = build(timeline());
    const html: string = option.tooltip.formatter([{ dataIndex: 0 }]);
    expect(html).toContain('data-testid="harvest-chart-tooltip"');
    expect(html).toContain("Semana de 04/05/2026");
    expect(html).toContain("Previsto: 221,05 kg");
    expect(html).toContain("Validado: 105 kg");
    expect(html).toContain("Pendente: 0 kg");

    const month = build(
      timeline({ granularity: "MONTH", points: [point("2026-05-01", 1000, 1500.5, 2)] }),
    );
    const monthHtml: string = month.tooltip.formatter([{ dataIndex: 0 }]);
    expect(monthHtml).toContain("Maio de 2026");
    expect(monthHtml).toContain("Validado: 1.500,5 kg");
  });

  it("tooltip do modo simples: Previsto e Realizado", () => {
    const option = build(
      timeline({ harvestType: "SINGLE", points: [point("2026-05-04", 0, 100, 30)] }),
    );
    const expected: string = option.tooltip.formatter([{ dataIndex: 0 }]);
    expect(expected).toContain("Previsto: 1.800 kg");
    const actual: string = option.tooltip.formatter([{ dataIndex: 1 }]);
    expect(actual).toContain("Validado: 100 kg");
    expect(actual).toContain("Pendente: 30 kg");
    expect(actual).not.toContain("Previsto:");
  });
});

describe("buildChartSummary", () => {
  it("BR-013: resumo textual com intervalo", () => {
    expect(
      buildChartSummary({
        hasExpected: true,
        expectedYield: 1800,
        validated: 105,
        pending: 0,
        from: "2026-05-04",
        to: "2026-06-29",
      }),
    ).toBe(
      "Previsto 1.800 kg, realizado 105 kg validados e 0 kg pendentes, de 04/05/2026 a 29/06/2026",
    );
  });

  it("sem previsto e sem intervalo", () => {
    expect(
      buildChartSummary({
        hasExpected: false,
        expectedYield: 0,
        validated: 1,
        pending: 2,
        from: null,
        to: null,
      }),
    ).toBe("Realizado 1 kg validados e 2 kg pendentes");
  });
});
