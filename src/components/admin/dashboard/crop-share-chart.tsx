"use client";

import { useEffect, useMemo, useRef } from "react";
import { BarChart, PieChart } from "echarts/charts";
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

import type {
  ManagementCommunityPerformance,
  ManagementCropRankingItem,
} from "@/lib/analytics";
import { formatNumber } from "@/lib/production";

registerEcharts([
  BarChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  AriaComponent,
  CanvasRenderer,
]);

const CHART_HEIGHT = 320;

export type ShareChartColors = {
  palette: string[];
  target: string;
  realized: string;
  text: string;
  grid: string;
  popover: string;
  popoverText: string;
  background: string;
};

const kg = (value: number) => `${formatNumber(value)} kg`;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cropLabel(item: ManagementCropRankingItem): string {
  return item.cropVariety ? `${item.cropName} (${item.cropVariety})` : item.cropName;
}

/** Só culturas com participação > 0 entram na rosca; a tabela segue sendo a fonte completa. */
export function sharedCrops(ranking: ManagementCropRankingItem[]) {
  // O back pode devolver participação > 0 mesmo sem nada colhido: sem
  // volume colhido não há o que mostrar na rosca.
  if (!ranking.some((r) => r.realizedKg > 0)) return [];
  return ranking.filter((r) => r.productionSharePct > 0);
}

export function buildCropShareSummary(ranking: ManagementCropRankingItem[]): string {
  const parts = sharedCrops(ranking).map(
    (r) => `${cropLabel(r)}: ${formatNumber(r.productionSharePct)}%`,
  );
  return `Participação de cada cultura na produção colhida. ${parts.join("; ")}`;
}

/** Option do ECharts (função pura, sem DOM): rosca com `productionSharePct`. */
export function buildCropShareOption(
  ranking: ManagementCropRankingItem[],
  colors: ShareChartColors,
  ariaLabel?: string,
): EChartsCoreOption {
  const items = sharedCrops(ranking);
  return {
    animation: false,
    aria: { enabled: true, label: { description: ariaLabel } },
    color: colors.palette,
    textStyle: { color: colors.text },
    legend: {
      type: "scroll",
      orient: "vertical",
      right: 0,
      top: "middle",
      textStyle: { color: colors.text },
      pageTextStyle: { color: colors.text },
    },
    tooltip: {
      trigger: "item",
      backgroundColor: colors.popover,
      borderColor: colors.grid,
      textStyle: { color: colors.popoverText },
      formatter: (params: unknown) => {
        const item = items[(params as { dataIndex: number }).dataIndex];
        if (!item) return "";
        return (
          `<div data-testid="crop-share-tooltip">` +
          `<p style="margin:0 0 4px;font-weight:600">${escapeHtml(cropLabel(item))}</p>` +
          `<ul style="margin:0;padding:0;list-style:none">` +
          `<li>Participação: ${formatNumber(item.productionSharePct)}%</li>` +
          `<li>Colhido: ${kg(item.realizedKg)}</li>` +
          `</ul></div>`
        );
      },
    },
    series: [
      {
        type: "pie",
        radius: ["45%", "72%"],
        center: ["38%", "50%"],
        label: { show: false },
        itemStyle: { borderColor: colors.background, borderWidth: 2 },
        data: items.map((r) => ({ name: cropLabel(r), value: r.productionSharePct })),
      },
    ],
  };
}

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
  colors: ShareChartColors,
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

function readColors(scope: Element): ShareChartColors {
  const style = getComputedStyle(scope);
  const token = (name: string) => toRgb(style.getPropertyValue(name).trim());
  return {
    palette: ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"].map(token),
    target: token("--chart-4"),
    realized: token("--chart-1"),
    text: token("--muted-foreground"),
    grid: token("--border"),
    popover: token("--popover"),
    popoverText: token("--popover-foreground"),
    background: token("--card"),
  };
}

function useEchart(
  hasData: boolean,
  render: (colors: ShareChartColors) => EChartsCoreOption,
  deps: unknown[],
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts | null>(null);

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
    chart.setOption(render(readColors(container)), true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasData, ...deps]);

  return containerRef;
}

/** Rosca de participação por cultura; sem colheita validada mostra um aviso. */
export function CropShareChart({ ranking }: { ranking: ManagementCropRankingItem[] }) {
  const hasData = sharedCrops(ranking).length > 0;
  const ariaLabel = useMemo(() => buildCropShareSummary(ranking), [ranking]);
  const containerRef = useEchart(
    hasData,
    (colors) => buildCropShareOption(ranking, colors, ariaLabel),
    [ranking, ariaLabel],
  );

  if (!hasData) {
    return (
      <p
        data-testid="crop-share-empty"
        className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground"
      >
        Ainda não há colheita validada nesta safra
      </p>
    );
  }

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={ariaLabel}
      data-testid="crop-share-chart"
      data-crops={sharedCrops(ranking).length}
      style={{ height: CHART_HEIGHT }}
      className="w-full max-w-full"
    />
  );
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
