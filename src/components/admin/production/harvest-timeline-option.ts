import type { EChartsCoreOption } from "echarts/core";

import type { HarvestTimeline, TimelineGranularity } from "@/lib/harvest-timeline";
import { formatNumber, formatPlanDate } from "@/lib/production";

/** Cores já resolvidas (o canvas do ECharts não entende `var()`), BR-012. */
export type ChartColors = {
  validated: string;
  pending: string;
  expected: string;
  text: string;
  grid: string;
  popover: string;
  popoverText: string;
};

export type ChartOptionInput = {
  /** Total previsto do plano (kg); usado no modo de colheita única. */
  expectedYield: number;
  /** Largura do contêiner em px; define quantos pontos cabem (BR-010). */
  width?: number;
  /** Resumo textual (BR-013); o ECharts o aplica ao aria-label do contêiner. */
  ariaLabel?: string;
};

/** Largura mínima por ponto antes de ativar a navegação por dataZoom (BR-010). */
export const MIN_POINT_WIDTH = 48;
const DEFAULT_WIDTH = 640;

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const kg = (value: number) => `${formatNumber(value)} kg`;

export function periodLabels(date: string, granularity: TimelineGranularity) {
  const [year, month, day] = date.split("-");
  if (granularity === "MONTH") {
    const name = MONTHS[Number(month) - 1];
    return {
      label: `${name.slice(0, 3)}/${year.slice(2)}`,
      title: `${name} de ${year}`,
    };
  }
  return {
    label: `${day}/${month}`,
    title: `Semana de ${day}/${month}/${year}`,
  };
}

export function buildChartSummary(input: {
  hasExpected: boolean;
  expectedYield: number;
  validated: number;
  pending: number;
  from: string | null;
  to: string | null;
}): string {
  const actual = `${kg(input.validated)} validados e ${kg(input.pending)} pendentes`;
  const summary = input.hasExpected
    ? `Previsto ${kg(input.expectedYield)}, realizado ${actual}`
    : `Realizado ${actual}`;
  return input.from && input.to
    ? `${summary}, de ${formatPlanDate(input.from)} a ${formatPlanDate(input.to)}`
    : summary;
}

type Row = {
  title: string;
  expected: number | null;
  validated: number;
  pending: number;
};

function renderTooltip(row: Row | undefined, showActual: boolean): string {
  if (!row) return "";
  const items: string[] = [];
  if (row.expected !== null) items.push(`<li>Previsto: ${kg(row.expected)}</li>`);
  if (showActual) {
    items.push(`<li>Validado: ${kg(row.validated)}</li>`);
    items.push(`<li>Pendente: ${kg(row.pending)}</li>`);
  }
  return (
    `<div data-testid="harvest-chart-tooltip">` +
    `<p style="margin:0 0 4px;font-weight:600">${row.title}</p>` +
    `<ul style="margin:0;padding:0;list-style:none">${items.join("")}</ul>` +
    `</div>`
  );
}

/**
 * Monta a option do ECharts (função pura, sem DOM — BR-016).
 * CONTINUOUS: barras empilhadas (validado + pendente) + linha do previsto.
 * SINGLE/nulo: duas categorias (Previsto, Realizado), sem eixo temporal.
 */
export function buildHarvestChartOption(
  timeline: HarvestTimeline,
  colors: ChartColors,
  input: ChartOptionInput,
): EChartsCoreOption {
  const isContinuous = timeline.harvestType === "CONTINUOUS";
  const points = timeline.points;

  let categories: string[];
  let rows: Row[];
  let series: Record<string, unknown>[];
  let legend: string[];

  const barStyle = (color: string) => ({ itemStyle: { color } });

  if (isContinuous) {
    const labelled = points.map((p) => ({
      p,
      ...periodLabels(p.date, timeline.granularity),
    }));
    categories = labelled.map((l) => l.label);
    rows = labelled.map(({ p, title }) => ({
      title,
      expected: timeline.hasExpectedWindow ? p.expectedValue : null,
      validated: p.actualValue,
      pending: p.pendingValue,
    }));
    series = [
      {
        name: "Validado",
        type: "bar",
        stack: "actual",
        barMaxWidth: 32,
        ...barStyle(colors.validated),
        data: points.map((p) => p.actualValue),
      },
      {
        name: "Pendente",
        type: "bar",
        stack: "actual",
        barMaxWidth: 32,
        ...barStyle(colors.pending),
        data: points.map((p) => p.pendingValue),
      },
    ];
    legend = ["Validado", "Pendente"];
    if (timeline.hasExpectedWindow) {
      series.push({
        name: "Previsto",
        type: "line",
        symbol: "none",
        smooth: false,
        lineStyle: { color: colors.expected, width: 2 },
        itemStyle: { color: colors.expected },
        data: points.map((p) => p.expectedValue),
      });
      legend = ["Previsto", ...legend];
    }
  } else {
    let validated = 0;
    let pending = 0;
    for (const p of points) {
      validated += p.actualValue;
      pending += p.pendingValue;
    }
    validated = Math.round(validated * 100) / 100;
    pending = Math.round(pending * 100) / 100;
    categories = ["Previsto", "Realizado"];
    rows = [
      { title: "Previsto", expected: input.expectedYield, validated: 0, pending: 0 },
      { title: "Realizado", expected: null, validated, pending },
    ];
    series = [
      {
        name: "Previsto",
        type: "bar",
        stack: "total",
        barMaxWidth: 72,
        ...barStyle(colors.expected),
        data: [input.expectedYield, null],
      },
      {
        name: "Validado",
        type: "bar",
        stack: "total",
        barMaxWidth: 72,
        ...barStyle(colors.validated),
        data: [null, validated],
      },
      {
        name: "Pendente",
        type: "bar",
        stack: "total",
        barMaxWidth: 72,
        ...barStyle(colors.pending),
        data: [null, pending],
      },
    ];
    legend = ["Previsto", "Validado", "Pendente"];
  }

  // BR-010: navegação por dataZoom quando os pontos não cabem.
  const width = input.width && input.width > 0 ? input.width : DEFAULT_WIDTH;
  const capacity = Math.max(1, Math.floor(width / MIN_POINT_WIDTH));
  const needsZoom = isContinuous && categories.length > capacity;
  const zoomWindow = {
    xAxisIndex: 0,
    filterMode: "none" as const,
    startValue: Math.max(0, categories.length - capacity),
    endValue: categories.length - 1,
  };

  const option: Record<string, unknown> = {
    animation: false,
    aria: {
      enabled: true,
      decal: { show: false },
      ...(input.ariaLabel ? { label: { description: input.ariaLabel } } : {}),
    },
    textStyle: { color: colors.text },
    legend: {
      data: legend,
      top: 0,
      itemWidth: 14,
      itemHeight: 8,
      textStyle: { color: colors.text, fontSize: 12 },
      inactiveColor: colors.grid,
    },
    grid: {
      top: 36,
      left: 8,
      right: 16,
      bottom: needsZoom ? 44 : 4,
      containLabel: true,
    },
    tooltip: {
      trigger: "axis",
      confine: true,
      axisPointer: { type: "shadow", shadowStyle: { color: colors.grid, opacity: 0.3 } },
      backgroundColor: colors.popover,
      borderColor: colors.grid,
      textStyle: { color: colors.popoverText, fontSize: 12 },
      formatter: (params: unknown) => {
        const first = Array.isArray(params) ? params[0] : params;
        const index = (first as { dataIndex?: number } | undefined)?.dataIndex ?? -1;
        return renderTooltip(rows[index], isContinuous || index === 1);
      },
    },
    xAxis: {
      type: "category",
      data: categories,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: colors.grid } },
      axisLabel: { color: colors.text, fontSize: 12, interval: 0 },
    },
    yAxis: {
      type: "value",
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: colors.text,
        fontSize: 12,
        formatter: (value: number) => formatNumber(value, 0),
      },
      splitLine: { lineStyle: { color: colors.grid, type: "dashed" } },
    },
    series,
  };

  if (needsZoom) {
    option.dataZoom = [
      { type: "inside", ...zoomWindow },
      {
        type: "slider",
        ...zoomWindow,
        height: 20,
        bottom: 6,
        showDetail: false,
        borderColor: colors.grid,
        fillerColor: colors.pending,
        textStyle: { color: colors.text },
      },
    ];
  }

  return option as EChartsCoreOption;
}
