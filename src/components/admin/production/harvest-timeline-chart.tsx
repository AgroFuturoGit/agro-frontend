"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BarChart, LineChart } from "echarts/charts";
import {
  AriaComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from "echarts/components";
import { init, use as registerEcharts, type ECharts } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getHarvestTimeline } from "@/lib/analytics";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  hasValidExpectedWindow,
  type HarvestTimeline,
  type TimelineGranularity,
} from "@/lib/harvest-timeline";
import type { ProductionExecution, ProductionPlan } from "@/lib/production";

import {
  buildChartSummary,
  buildHarvestChartOption,
  MIN_POINT_WIDTH,
  type ChartColors,
} from "./harvest-timeline-option";

// BR-015: só o necessário do ECharts.
registerEcharts([
  BarChart,
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  AriaComponent,
  CanvasRenderer,
]);

const CHART_HEIGHT = 320;
const PENDING_OPACITY = 0.35;

const NO_WINDOW_WARNING =
  "Defina o início e o fim previstos da colheita para ver a curva prevista.";
const EMPTY_MESSAGE =
  "Ainda não há dados para o gráfico. Registre um apontamento ou defina a janela de colheita.";

/**
 * Converte um valor CSS de cor (inclusive oklch) em "rgb()/rgba()" que o
 * canvas do ECharts entende, pintando 1 pixel e lendo-o de volta.
 */
function toRgb(value: string, alpha = 1): string {
  try {
    const ctx = document.createElement("canvas").getContext("2d", {
      willReadFrequently: true,
    });
    if (!ctx) return value;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    const total = Math.round((a / 255) * alpha * 100) / 100;
    return total >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${total})`;
  } catch {
    return value;
  }
}

/**
 * BR-012: lê os tokens do tema já resolvidos no escopo do próprio gráfico
 * (a área admin força `.light` num wrapper; ler só do <html> divergiria).
 */
function readChartColors(scope: Element): ChartColors {
  const style = getComputedStyle(scope);
  const token = (name: string) => style.getPropertyValue(name).trim();
  return {
    validated: toRgb(token("--chart-1")),
    pending: toRgb(token("--chart-1"), PENDING_OPACITY),
    expected: toRgb(token("--chart-4")),
    text: toRgb(token("--muted-foreground")),
    grid: toRgb(token("--border")),
    popover: toRgb(token("--popover")),
    popoverText: toRgb(token("--popover-foreground")),
  };
}

/**
 * Contador que sobe quando o tema muda: classe/atributo do <html> ou de
 * qualquer ancestral do gráfico, ou a preferência de cor do SO.
 */
function useThemeVersion(
  scope: React.RefObject<Element | null>,
  mounted: boolean,
): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    const observer = new MutationObserver(bump);
    for (
      let el: Element | null = scope.current;
      el;
      el = el.parentElement
    ) {
      observer.observe(el, {
        attributes: true,
        attributeFilter: ["class", "data-theme"],
      });
    }
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    media?.addEventListener?.("change", bump);
    return () => {
      observer.disconnect();
      media?.removeEventListener?.("change", bump);
    };
  }, [scope, mounted]);
  return version;
}

type Props = {
  plan: ProductionPlan;
  executions: ProductionExecution[];
};

/**
 * Gráfico previsto × realizado do detalhe do plano (Feature 6.4).
 * Culturas CONTINUOUS: barras empilhadas (validado + pendente) por semana ou
 * mês e linha do previsto. SINGLE/nulo: barras simples Previsto × Realizado.
 */
export function ContinuousHarvestChart({ plan, executions }: Props) {
  // BR-007: abre em semana ("siga o back"); o usuário alterna para mês.
  const [choice, setChoice] = useState<TimelineGranularity>("WEEK");
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts | null>(null);
  const [data, setData] = useState<Awaited<
    ReturnType<typeof getHarvestTimeline>
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  // BR-008: recarrega quando a lista de apontamentos (ou a granularidade) muda.
  const load = useCallback(async () => {
    const request = ++requestRef.current;
    setLoading(true);
    setError(null);
    try {
      const response = await getHarvestTimeline(plan.id, choice);
      if (request === requestRef.current) setData(response);
    } catch (err) {
      if (request !== requestRef.current) return;
      setData(null);
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar o gráfico de colheita.",
      );
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [plan.id, choice]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load, executions]);

  const hasWindow = hasValidExpectedWindow(plan);

  const timeline = useMemo<HarvestTimeline>(
    () => ({
      harvestType: data?.harvestType ?? (plan.crop?.harvestType === "CONTINUOUS" ? "CONTINUOUS" : "SINGLE"),
      granularity: data?.granularity ?? choice,
      unit: "kg",
      hasExpectedWindow: hasWindow,
      points: data?.points ?? [],
    }),
    [data, plan.crop?.harvestType, choice, hasWindow],
  );

  const isContinuous = timeline.harvestType === "CONTINUOUS";
  const points = timeline.points;

  const totals = useMemo(() => {
    let validated = 0;
    let pending = 0;
    for (const p of points) {
      validated += p.actualValue;
      pending += p.pendingValue;
    }
    return {
      validated: Math.round(validated * 100) / 100,
      pending: Math.round(pending * 100) / 100,
    };
  }, [points]);

  const isEmpty =
    !loading &&
    !error &&
    (isContinuous
      ? points.length === 0
      : points.length === 0 && plan.expectedYield <= 0);
  const showChart = !error && !isEmpty && data !== null;

  const hasExpected = isContinuous ? hasWindow : plan.expectedYield > 0;

  const ariaLabel = buildChartSummary({
    hasExpected,
    expectedYield: plan.expectedYield,
    validated: totals.validated,
    pending: totals.pending,
    from: plan.expectedHarvestStart ?? points[0]?.date ?? null,
    to: plan.expectedHarvestEnd ?? points[points.length - 1]?.date ?? null,
  });

  const themeVersion = useThemeVersion(containerRef, showChart);
  // Quantos pontos cabem na largura atual. Quando muda (girar o celular,
  // recolher a sidebar), a option é refeita para ligar/desligar o dataZoom.
  const [pointCapacity, setPointCapacity] = useState(0);
  const appliedCapacityRef = useRef<number | null>(null);

  // BR-015: init no mount, resize via ResizeObserver, dispose no unmount.
  useEffect(() => {
    const container = containerRef.current;
    if (!showChart || !container) return;
    const chart = init(container, undefined, { renderer: "canvas" });
    chartRef.current = chart;
    const observer = new ResizeObserver(() => {
      chart.resize();
      const capacity = Math.floor(container.clientWidth / MIN_POINT_WIDTH);
      if (capacity !== appliedCapacityRef.current) setPointCapacity(capacity);
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, [showChart]);

  // setOption a cada mudança de dados, granularidade ou tema.
  useEffect(() => {
    const chart = chartRef.current;
    const container = containerRef.current;
    if (!showChart || loading || !chart || !container) return;
    const option = buildHarvestChartOption(timeline, readChartColors(container), {
      expectedYield: plan.expectedYield,
      width: container.clientWidth,
      ariaLabel,
    });
    chart.setOption(option, true);
    appliedCapacityRef.current = Math.floor(container.clientWidth / MIN_POINT_WIDTH);
  }, [showChart, loading, timeline, plan.expectedYield, ariaLabel, themeVersion, pointCapacity]);

  if (error) {
    return (
      <Card>
        <CardContent className="py-4">
          <div
            role="alert"
            className="flex items-start justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            <span>{error}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => load()}>
              Tentar novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading && data === null) {
    return <Skeleton className="h-80 w-full rounded-xl" aria-label="Carregando gráfico" />;
  }

  if (isEmpty) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-sm text-muted-foreground">{EMPTY_MESSAGE}</p>
        </CardContent>
      </Card>
    );
  }

  const active = choice;
  const refreshing = loading && data !== null;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold tracking-tight">
              Previsto × realizado
            </h3>
            <p className="text-sm text-muted-foreground">
              {isContinuous
                ? `Colheita por ${active === "WEEK" ? "semana" : "mês"}, em kg.`
                : "Total previsto e total colhido, em kg."}
            </p>
          </div>
          {isContinuous && (
            <div
              role="group"
              aria-label="Agrupar por"
              className="inline-flex rounded-md border p-0.5"
            >
              {(
                [
                  ["WEEK", "Semana"],
                  ["MONTH", "Mês"],
                ] as const
              ).map(([value, text]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active === value}
                  onClick={() => setChoice(value)}
                  className={cn(
                    "rounded-sm px-3 py-1 text-sm transition-colors",
                    active === value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {text}
                </button>
              ))}
            </div>
          )}
        </div>

        {isContinuous && !timeline.hasExpectedWindow && (
          <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            {NO_WINDOW_WARNING}
          </p>
        )}

        {/*
          Recarga com dados já na tela (troca Semana/Mês ou novo apontamento):
          o gráfico anterior fica esmaecido e marcado como ocupado até a
          resposta chegar, em vez de parecer já atualizado.
        */}
        <div className="relative" aria-busy={refreshing}>
          <div
            ref={containerRef}
            role="img"
            aria-label={ariaLabel}
            data-mode={isContinuous ? "composite" : "simple"}
            data-granularity={isContinuous ? active : undefined}
            data-points={isContinuous ? points.length : 2}
            data-has-window={String(hasExpected)}
            style={{ height: CHART_HEIGHT }}
            className={cn(
              "w-full max-w-full transition-opacity",
              refreshing && "opacity-40",
            )}
          />
          {refreshing && (
            <p
              role="status"
              className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground"
            >
              Atualizando gráfico…
            </p>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Somente validados contam no realizado oficial.
        </p>
      </CardContent>
    </Card>
  );
}
