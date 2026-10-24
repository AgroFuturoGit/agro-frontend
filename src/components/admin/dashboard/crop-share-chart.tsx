"use client";

import { useMemo } from "react";
import type { EChartsCoreOption } from "echarts/core";

import type { ManagementCropRankingItem } from "@/lib/analytics";
import { formatNumber } from "@/lib/production";

import {
  CHART_HEIGHT,
  escapeHtml,
  kg,
  useEchart,
  type ChartColors,
} from "./chart-utils";

export type ShareChartColors = Omit<ChartColors, "pending">;

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
