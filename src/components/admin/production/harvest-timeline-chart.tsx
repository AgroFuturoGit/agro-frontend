"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
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

import { ChartNoAxesColumn, Info } from "lucide-react";

import { EmptyState } from "@/components/admin/empty-state";
import { SectionHeader } from "@/components/admin/section-header";
import {
  readChartFontFamily,
  readToken,
  toRgb,
} from "@/components/admin/dashboard/chart-tokens";
import { Card } from "@/components/ui/card";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { moveFocusTo } from "@/lib/focus";
import { getHarvestTimeline } from "@/lib/analytics";
import { apiErrorMessage } from "@/lib/api";
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
const LOAD_ERROR = "Não foi possível carregar o gráfico de colheita.";
const TITLE = "Previsto × realizado";

/**
 * BR-012: lê os tokens do tema já resolvidos no escopo do próprio gráfico
 * (a área admin força `.light` num wrapper; ler só do <html> divergiria).
 */
function readChartColors(scope: Element): ChartColors {
  const token = (name: string) => readToken(scope, name);
  return {
    validated: toRgb(token("--chart-1")),
    pending: toRgb(token("--chart-1"), PENDING_OPACITY),
    expected: toRgb(token("--chart-4")),
    text: toRgb(token("--muted-foreground")),
    grid: toRgb(token("--border")),
    popover: toRgb(token("--popover")),
    popoverText: toRgb(token("--popover-foreground")),
    fontFamily: readChartFontFamily(),
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

/**
 * Skeleton com a forma do card pronto (título, descrição, gráfico de 320px e
 * legenda), para a seção de baixo não saltar quando o gráfico chega.
 */
export function HarvestChartSkeleton() {
  return (
    <Card role="group" aria-busy="true" aria-label="Carregando gráfico" className="p-6">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-6 w-64 max-w-full" />
      </div>
      <Skeleton className="w-full" style={{ height: CHART_HEIGHT }} />
      <Skeleton className="h-4 w-56" />
      <span role="status" className="sr-only">Carregando gráfico…</span>
    </Card>
  );
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
  // Alvo do foco do "Tentar novamente" (A11Y-L6-5): o <h3> do card fica
  // montado de erro → carregando → gráfico (mesma raiz <Card>).
  const titleId = useId();

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
      // "Erro 500" cru não ajuda o usuário: cai na mensagem genérica.
      setError(
        apiErrorMessage(err, LOAD_ERROR),
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
      <Card className="p-6">
        <SectionHeader id={titleId} title={TITLE} />
        <InlineAlert
          variant="destructive"
          // O alerta desmonta com a nova carga: o foco vai ao título do card.
          action={{
            label: "Tentar novamente",
            onClick: () => {
              moveFocusTo(titleId);
              load();
            },
          }}
        >
          {error}
        </InlineAlert>
      </Card>
    );
  }

  if (loading && data === null) {
    // Recarga depois do erro: mesma raiz <Card> com o título real, para o
    // foco do "Tentar novamente" não se perder. Na primeira carga também.
    return (
      // role="group": nome em <div> genérico é proibido (A11Y-L6-R2-2). A
      // descrição em skeleton evita o salto quando o gráfico chega (UX-L6-R2-1).
      <Card role="group" aria-busy="true" aria-label="Carregando gráfico" className="p-6">
        <SectionHeader
          id={titleId}
          title={TITLE}
          description={
            <span
              aria-hidden="true"
              data-slot="skeleton"
              className="block h-6 w-64 max-w-full animate-pulse rounded-md bg-muted"
            />
          }
        />
        <Skeleton aria-hidden="true" className="w-full" style={{ height: CHART_HEIGHT }} />
        <Skeleton aria-hidden="true" className="h-4 w-56" />
        <span role="status" className="sr-only">Carregando gráfico…</span>
      </Card>
    );
  }

  if (isEmpty) {
    return (
      <Card className="p-6">
        <SectionHeader id={titleId} title={TITLE} />
        <EmptyState icon={ChartNoAxesColumn} title={EMPTY_MESSAGE} className="py-8" />
      </Card>
    );
  }

  const active = choice;
  const refreshing = loading && data !== null;

  return (
    <Card className="p-6">
      <SectionHeader
        id={titleId}
        title={TITLE}
        description={
          isContinuous
            ? `Colheita por ${active === "WEEK" ? "semana" : "mês"}, em kg.`
            : "Total previsto e total colhido, em kg."
        }
        actions={
          isContinuous ? (
            <div
              role="group"
              aria-label="Agrupar por"
              className="inline-flex h-control overflow-hidden rounded-lg border border-input bg-card"
            >
              {(
                [
                  ["WEEK", "Semana"],
                  ["MONTH", "Mês"],
                ] as const
              ).map(([value, text], index) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active === value}
                  onClick={() => setChoice(value)}
                  className={cn(
                    "min-w-11 px-4 text-sm font-medium transition-colors outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset motion-reduce:transition-none",
                    index > 0 && "border-l border-input",
                    // --ring = --primary: no segmento ativo (fundo verde) o anel
                    // vira o primary-foreground para continuar visível.
                    active === value
                      ? "bg-primary text-primary-foreground focus-visible:ring-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {text}
                </button>
              ))}
            </div>
          ) : undefined
        }
      />

      {isContinuous && !timeline.hasExpectedWindow && (
        // Dica estática (não é live region): o aviso não muda sozinho.
        <div className="flex items-start gap-3 rounded-lg border border-border bg-surface-subtle px-4 py-3 text-sm text-muted-foreground">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <p>{NO_WINDOW_WARNING}</p>
        </div>
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
            "w-full max-w-full transition-opacity motion-reduce:transition-none",
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
    </Card>
  );
}
