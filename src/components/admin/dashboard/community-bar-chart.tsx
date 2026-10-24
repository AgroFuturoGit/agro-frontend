"use client";

import { useEffect, useMemo, useRef } from "react";
import { BarChart } from "echarts/charts";
import {
  AriaComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from "echarts/components";
import {
  init,
  use as registerEcharts,
  type ECharts,
  type EChartsCoreOption,
} from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";

import type { TechnicianCommunitySummary } from "@/lib/analytics";
import { formatNumber } from "@/lib/production";

registerEcharts([
  BarChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  AriaComponent,
  CanvasRenderer,
]);

const CHART_HEIGHT = 320;

export type CommunityChartColors = {
  target: string;
  realized: string;
  pending: string;
  text: string;
  grid: string;
  popover: string;
  popoverText: string;
};

const kg = (value: number) => `${formatNumber(value)} kg`;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Resumo textual do gráfico, usado como `aria-label`. */
export function buildCommunityChartSummary(
  communities: TechnicianCommunitySummary[],
): string {
  const parts = communities.map(
    (c) =>
      `${c.communityName}: meta ${kg(c.targetKg)}, realizado ${kg(c.realizedKg)}, pendente ${kg(c.pendingKg)}`,
  );
  return `Meta, realizado e pendente por comunidade. ${parts.join("; ")}`;
}

/** Option do ECharts (função pura, sem DOM): barras agrupadas por comunidade. */
export function buildCommunityChartOption(
  communities: TechnicianCommunitySummary[],
  colors: CommunityChartColors,
  ariaLabel?: string,
): EChartsCoreOption {
  const bar = (name: string, color: string, pick: (c: TechnicianCommunitySummary) => number) => ({
    name,
    type: "bar",
    barMaxWidth: 28,
    itemStyle: { color },
    data: communities.map(pick),
  });
  return {
    animation: false,
    aria: { enabled: true, label: { description: ariaLabel } },
    textStyle: { color: colors.text },
    legend: {
      data: ["Meta", "Realizado", "Pendente"],
      top: 0,
      textStyle: { color: colors.text },
    },
    grid: { left: 8, right: 16, top: 40, bottom: 8, containLabel: true },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: colors.popover,
      borderColor: colors.grid,
      textStyle: { color: colors.popoverText },
      formatter: (params: unknown) => {
        const items = (Array.isArray(params) ? params : [params]) as {
          dataIndex: number;
        }[];
        const c = communities[items[0]?.dataIndex ?? -1];
        if (!c) return "";
        return (
          `<div data-testid="community-chart-tooltip">` +
          `<p style="margin:0 0 4px;font-weight:600">${escapeHtml(c.communityName)}</p>` +
          `<ul style="margin:0;padding:0;list-style:none">` +
          `<li>Meta: ${kg(c.targetKg)}</li>` +
          `<li>Realizado: ${kg(c.realizedKg)}</li>` +
          `<li>Pendente: ${kg(c.pendingKg)}</li>` +
          `</ul></div>`
        );
      },
    },
    xAxis: {
      type: "category",
      data: communities.map((c) => c.communityName),
      axisLabel: { color: colors.text, interval: 0, hideOverlap: true },
      axisLine: { lineStyle: { color: colors.grid } },
    },
    yAxis: {
      type: "value",
      name: "kg",
      nameTextStyle: { color: colors.text },
      axisLabel: { color: colors.text },
      splitLine: { lineStyle: { color: colors.grid } },
    },
    series: [
      bar("Meta", colors.target, (c) => c.targetKg),
      bar("Realizado", colors.realized, (c) => c.realizedKg),
      bar("Pendente", colors.pending, (c) => c.pendingKg),
    ],
  };
}

function toRgb(value: string): string {
  try {
    const ctx = document.createElement("canvas").getContext("2d", {
      willReadFrequently: true,
    });
    if (!ctx) return value;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return `rgb(${r}, ${g}, ${b})`;
  } catch {
    return value;
  }
}

function readColors(scope: Element): CommunityChartColors {
  const style = getComputedStyle(scope);
  const token = (name: string) => toRgb(style.getPropertyValue(name).trim());
  return {
    target: token("--chart-4"),
    realized: token("--chart-1"),
    pending: token("--chart-2"),
    text: token("--muted-foreground"),
    grid: token("--border"),
    popover: token("--popover"),
    popoverText: token("--popover-foreground"),
  };
}

/** Barras agrupadas por comunidade (meta × realizado × pendente, em kg). */
export function CommunityBarChart({
  communities,
}: {
  communities: TechnicianCommunitySummary[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts | null>(null);
  const hasData = communities.length > 0;
  const ariaLabel = useMemo(
    () => buildCommunityChartSummary(communities),
    [communities],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!hasData || !container) return;
    const chart = init(container, undefined, { renderer: "canvas" });
    chartRef.current = chart;
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(container);
    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, [hasData]);

  useEffect(() => {
    const chart = chartRef.current;
    const container = containerRef.current;
    if (!hasData || !chart || !container) return;
    chart.setOption(
      buildCommunityChartOption(communities, readColors(container), ariaLabel),
      true,
    );
  }, [hasData, communities, ariaLabel]);

  if (!hasData) return null;

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={ariaLabel}
      data-testid="community-bar-chart"
      data-communities={communities.length}
      style={{ height: CHART_HEIGHT }}
      className="w-full max-w-full"
    />
  );
}
