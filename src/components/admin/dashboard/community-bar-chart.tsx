"use client";

import { useMemo } from "react";
import type { EChartsCoreOption } from "echarts/core";

import type { TechnicianCommunitySummary } from "@/lib/analytics";

import {
  CHART_HEIGHT,
  escapeHtml,
  kg,
  useEchart,
  type ChartColors,
} from "./chart-utils";

export type CommunityChartColors = Omit<ChartColors, "palette" | "background">;

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

/** Barras agrupadas por comunidade (meta × realizado × pendente, em kg). */
export function CommunityBarChart({
  communities,
}: {
  communities: TechnicianCommunitySummary[];
}) {
  const hasData = communities.length > 0;
  const ariaLabel = useMemo(
    () => buildCommunityChartSummary(communities),
    [communities],
  );
  const containerRef = useEchart(
    hasData,
    (colors) => buildCommunityChartOption(communities, colors, ariaLabel),
    [communities, ariaLabel],
  );

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
