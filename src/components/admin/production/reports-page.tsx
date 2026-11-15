"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ClipboardList, Info } from "lucide-react";

import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { SectionHeader } from "@/components/admin/section-header";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { harvestText } from "@/lib/harvest-label";
import { ApiError, userFacingErrorHint } from "@/lib/api";
import { cn } from "@/lib/utils";
import { getMyProducer, type Producer } from "@/lib/producers";
import {
  formatNumber,
  getProductionComparison,
  listProductionPlans,
  type ProductionComparison,
  type ProductionPlan,
} from "@/lib/production";

import { ComparisonSummary } from "./comparison-summary";

const LOAD_ERROR = "Não foi possível carregar os relatórios.";

const planTitle = (plan: ProductionPlan) =>
  plan.crop ? `${plan.crop.name} — ${plan.crop.variety}` : "Plano";

type PlanReport = {
  plan: ProductionPlan;
  comparison: ProductionComparison | null;
};

export function ReportsPage() {
  const [reports, setReports] = useState<PlanReport[]>([]);
  // Guardado aqui para montar o link "Ver detalhes" com a URL aninhada
  // correta (`/admin/organizacoes/{orgId}/comunidades/{communityId}/
  // produtores/{producerId}/planos/{planId}`), já que
  // `/admin/cultivos/{planId}` não existe mais.
  //
  // Esta tela só funciona para FARMER: `refresh()` chama `getMyProducer()`
  // (`GET /farmers/me`, `hasRole('FARMER')`). Por isso o item "Relatórios"
  // da sidebar e o grupo `/admin/relatorios` do `proxy.ts` são restritos a
  // FARMER — as demais roles recebiam 403.
  const [producer, setProducer] = useState<Producer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const producerData = await getMyProducer();
      setProducer(producerData);
      const plans = await listProductionPlans(producerData.id);
      const data = await Promise.all(
        plans.map(async (plan) => {
          try {
            const comparison = await getProductionComparison(plan.id);
            return { plan, comparison };
          } catch {
            return { plan, comparison: null };
          }
        }),
      );
      setReports(data);
    } catch (err) {
      setError(
        (err instanceof ApiError ? userFacingErrorHint(err.message) : undefined) ??
          LOAD_ERROR,
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const withComparison = useMemo(
    () =>
      reports.filter(
        (r): r is { plan: ProductionPlan; comparison: ProductionComparison } =>
          r.comparison !== null,
      ),
    [reports],
  );

  const totals = useMemo<ProductionComparison | null>(() => {
    if (withComparison.length === 0) return null;
    const expectedYield = withComparison.reduce(
      (acc, r) => acc + r.comparison.expectedYield,
      0,
    );
    const totalActualYield = withComparison.reduce(
      (acc, r) => acc + r.comparison.totalActualYield,
      0,
    );
    const difference = totalActualYield - expectedYield;
    const percentageRealized =
      expectedYield > 0 ? (totalActualYield / expectedYield) * 100 : 0;
    return {
      productionPlanId: "",
      expectedYield,
      totalActualYield,
      difference,
      percentageRealized,
    };
  }, [withComparison]);

  const chartMax = useMemo(
    () =>
      Math.max(
        1,
        ...withComparison.flatMap((r) => [
          r.comparison.expectedYield,
          r.comparison.totalActualYield,
        ]),
      ),
    [withComparison],
  );

  const producerBase = producer?.community?.organization
    ? `/admin/organizacoes/${producer.community.organization.id}/comunidades/${producer.community.id}/produtores/${producer.id}`
    : null;

  let body: React.ReactNode;
  if (loading) {
    body = (
      <div
        className="flex flex-col gap-8"
        role="region"
        aria-busy="true"
        aria-label="Carregando relatórios"
      >
        <div className="flex flex-col gap-4">
          <Skeleton className="h-7 w-40" />
          <ComparisonSummary comparison={null} loading />
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-6 w-80 max-w-full" />
          </div>
          <Skeleton className="h-56 w-full rounded-xl" />
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-7 w-56" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <Skeleton key={idx} className="h-64 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  } else if (reports.length === 0) {
    // Com erro na primeira carga, o alerta basta: não mostrar um vazio falso.
    body = error ? null : (
      <EmptyState
        variant="dashed"
        icon={ClipboardList}
        title="Nenhum plano de produção para exibir"
        hint="Cadastre um plano de produção para começar. O comparativo de previsto e realizado aparece aqui."
        action={
          producerBase
            ? { label: "Ir para os meus planos", href: producerBase, variant: "default" }
            : undefined
        }
      />
    );
  } else {
    body = (
      <div className="flex flex-col gap-8">
        {totals && (
          <section className="flex flex-col gap-4" aria-labelledby="reports-total">
            <SectionHeader
              id="reports-total"
              title="Consolidado"
              description={`Soma de ${withComparison.length} ${
                withComparison.length === 1 ? "plano" : "planos"
              } de produção.`}
            />
            <ComparisonSummary comparison={totals} />
          </section>
        )}

        {withComparison.length > 0 && (
          <section className="flex flex-col gap-4" aria-labelledby="reports-chart">
            <SectionHeader
              id="reports-chart"
              title="Previsto vs Realizado por plano"
              description="Comparação da colheita prevista e realizada de cada cultivo."
            />
            <Card className="gap-4 p-6">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="size-3 rounded-sm bg-primary/15 ring-1 ring-primary/30"
                  />
                  Previsto
                </span>
                <span className="inline-flex items-center gap-2">
                  <span aria-hidden="true" className="size-3 rounded-sm bg-primary" />
                  Realizado
                </span>
              </div>

              <ul className="flex flex-col gap-4">
                {withComparison.map(({ plan, comparison }) => (
                  <li key={plan.id} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span
                        className="truncate text-sm font-medium text-foreground"
                        title={planTitle(plan)}
                      >
                        {planTitle(plan)}
                      </span>
                      <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                        Realizado {formatNumber(comparison.totalActualYield)} kg de{" "}
                        {formatNumber(comparison.expectedYield)} kg previstos
                      </span>
                    </div>
                    <div aria-hidden="true" className="relative h-7 w-full overflow-hidden rounded-md bg-muted">
                      <div
                        className="absolute inset-y-0 left-0 rounded-md bg-primary/15 ring-1 ring-inset ring-primary/25"
                        style={{
                          width: `${(comparison.expectedYield / chartMax) * 100}%`,
                        }}
                      />
                      <div
                        className="absolute inset-y-1 left-0 rounded-sm bg-primary transition-all motion-reduce:transition-none"
                        style={{
                          width: `${(comparison.totalActualYield / chartMax) * 100}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        )}

        <section className="flex flex-col gap-4" aria-labelledby="reports-plans">
          <SectionHeader id="reports-plans" title="Por plano de produção" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {reports.map(({ plan, comparison }) => {
              const percentage = comparison?.percentageRealized ?? 0;
              return (
                <Card key={plan.id} className="gap-4 py-6">
                  <CardHeader className="px-6">
                    <CardTitle className="line-clamp-2 text-base font-semibold break-words">
                      {planTitle(plan)}
                    </CardTitle>
                    <CardDescription className="text-sm text-muted-foreground">
                      {harvestText(plan.harvest?.label)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-4 px-6">
                    {comparison ? (
                      <>
                        <div className="flex flex-col gap-2">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-kpi font-bold text-foreground tabular-nums">
                              {formatNumber(percentage)}%
                            </span>
                            <span className="text-base text-muted-foreground">
                              da meta
                            </span>
                          </div>
                          <Progress
                            value={Math.max(0, Math.min(100, percentage))}
                            variant="primary"
                            aria-label={`Progresso de ${planTitle(plan)} em relação à meta`}
                          />
                        </div>
                        <div className="flex justify-between gap-2 text-sm text-muted-foreground">
                          <span>
                            Realizado{" "}
                            <span className="font-medium text-foreground tabular-nums">
                              {formatNumber(comparison.totalActualYield)} kg
                            </span>
                          </span>
                          <span>
                            Previsto{" "}
                            <span className="font-medium text-foreground tabular-nums">
                              {formatNumber(comparison.expectedYield)} kg
                            </span>
                          </span>
                        </div>
                      </>
                    ) : (
                      <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Info aria-hidden="true" className="size-4 shrink-0" />
                        Comparativo indisponível.
                      </p>
                    )}
                    {/* Link de verdade (role=link) com o visual do botão outline. Sem
                        comunidade/organização não há rota do plano: sem link. */}
                    {producerBase ? (
                      <Link
                        href={`${producerBase}/planos/${plan.id}`}
                        className={cn(buttonVariants({ variant: "outline" }), "mt-auto self-start")}
                      >
                        Ver detalhes
                        <span className="sr-only">
                          {" "}
                          de {planTitle(plan)}, {harvestText(plan.harvest?.label)}
                        </span>
                        <ArrowRight aria-hidden="true" />
                      </Link>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Relatórios"
        description="Comparativo de previsto vs realizado (em kg) por plano de produção. Somente apontamentos validados contam no realizado."
      />

      {error && (
        <InlineAlert action={{ label: "Tentar novamente", onClick: () => refresh() }}>
          {error}
        </InlineAlert>
      )}

      {body}
    </div>
  );
}
