"use client";

import { useEffect, useRef, useState } from "react";
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

export const CHART_HEIGHT = 320;

export type ChartColors = {
  palette: string[];
  target: string;
  realized: string;
  pending: string;
  text: string;
  grid: string;
  popover: string;
  popoverText: string;
  background: string;
};

export const kg = (value: number) => `${formatNumber(value)} kg`;

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

/** Lê os tokens de cor (CSS vars) do tema vigente no escopo informado. */
export function readChartColors(scope: Element): ChartColors {
  const style = getComputedStyle(scope);
  const token = (name: string) => toRgb(style.getPropertyValue(name).trim());
  return {
    palette: ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"].map(token),
    target: token("--chart-4"),
    realized: token("--chart-1"),
    pending: token("--chart-2"),
    text: token("--muted-foreground"),
    grid: token("--border"),
    popover: token("--popover"),
    popoverText: token("--popover-foreground"),
    background: token("--card"),
  };
}

/**
 * Contador que sobe quando o tema muda: classe/atributo do <html> ou a
 * preferência de cor do SO.
 */
export function useThemeVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    const observer = new MutationObserver(bump);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    media?.addEventListener?.("change", bump);
    return () => {
      observer.disconnect();
      media?.removeEventListener?.("change", bump);
    };
  }, []);
  return version;
}

/** Ciclo de vida do ECharts: init/resize/dispose e reaplicação da option (também na troca de tema). */
export function useEchart(
  hasData: boolean,
  render: (colors: ChartColors) => EChartsCoreOption,
  deps: unknown[],
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts | null>(null);
  const themeVersion = useThemeVersion();

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
    chart.setOption(render(readChartColors(container)), true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasData, themeVersion, ...deps]);

  return containerRef;
}
