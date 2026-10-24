"use client";

import { useMemo } from "react";
import type { EChartsCoreOption } from "echarts/core";

import type { ManagementCommunityPerformance } from "@/lib/analytics";
import { formatNumber } from "@/lib/production";

import {
  CHART_HEIGHT,
  escapeHtml,
  kg,
  useEchart,
  type ChartColors,
} from "./chart-utils";

export type CommunityTargetColors = Omit<ChartColors, "palette" | "pending">;

export function buildCommunityTargetSummary(
  communities: ManagementCommunityPerformance[],
): string {
  const parts = communities.map(
    (c) => `${c.communityName}: meta ${kg(c.targetKg)}, colhido ${kg(c.realizedKg)}`,
  );
  return `Meta e colhido por comunidade. ${parts.join("; ")}`;
}

/** Option do ECharts: barras agrupadas meta × colhido por comunidade. */
export function buildCommunityTargetOption(
  communities: ManagementCommunityPerformance[],
  colors: CommunityTargetColors,
  ariaLabel?: string,
): EChartsCoreOption {
  const bar = (
    name: string,
    color: string,
    pick: (c: ManagementCommunityPerformance) => number,
  ) => ({
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
    legend: { data: ["Meta", "Colhido"], top: 0, textStyle: { color: colors.text } },
    grid: { left: 8, right: 16, top: 40, bottom: 8, containLabel: true },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: colors.popover,
      borderColor: colors.grid,
      textStyle: { color: colors.popoverText },
      formatter: (params: unknown) => {
        const entries = (Array.isArray(params) ? params : [params]) as {
          dataIndex: number;
        }[];
        const c = communities[entries[0]?.dataIndex ?? -1];
        if (!c) return "";
        return (
          `<div data-testid="management-community-tooltip">` +
          `<p style="margin:0 0 4px;font-weight:600">${escapeHtml(c.communityName)}</p>` +
          `<ul style="margin:0;padding:0;list-style:none">` +
          `<li>Meta: ${kg(c.targetKg)}</li>` +
          `<li>Colhido: ${kg(c.realizedKg)}</li>` +
          `<li>Conversão: ${formatNumber(c.conversionRatePct)}%</li>` +
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
      bar("Colhido", colors.realized, (c) => c.realizedKg),
    ],
  };
}

/** Barras agrupadas meta × colhido por comunidade (kg). */
export function CommunityTargetChart({
  communities,
}: {
  communities: ManagementCommunityPerformance[];
}) {
  const hasData = communities.length > 0;
  const ariaLabel = useMemo(() => buildCommunityTargetSummary(communities), [communities]);
  const containerRef = useEchart(
    hasData,
    (colors) => buildCommunityTargetOption(communities, colors, ariaLabel),
    [communities, ariaLabel],
  );

  if (!hasData) return null;

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={ariaLabel}
      data-testid="management-community-chart"
      data-communities={communities.length}
      style={{ height: CHART_HEIGHT }}
      className="w-full max-w-full"
    />
  );
}
