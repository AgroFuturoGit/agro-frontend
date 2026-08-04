"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import { getMyProducer } from "@/lib/producers";
import {
  formatNumber,
  getProductionComparison,
  listProductionPlans,
  type ProductionComparison,
  type ProductionPlan,
} from "@/lib/production";

import { ComparisonSummary } from "./comparison-summary";

type PlanReport = {
  plan: ProductionPlan;
  comparison: ProductionComparison | null;
};

export function ReportsPage() {
  const [reports, setReports] = useState<PlanReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const producer = await getMyProducer();
      const plans = await listProductionPlans(producer.id);
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
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar os relatórios.",
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Relatórios</h2>
        <p className="text-sm text-muted-foreground">
          Comparativo de previsto vs realizado por plano de produção.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refresh()}
          >
            Tentar novamente
          </Button>
        </div>
      )}

      {loading ? (
        <>
          <Skeleton className="h-40 w-full rounded-xl" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <Skeleton key={idx} className="h-44 w-full rounded-xl" />
            ))}
          </div>
        </>
      ) : reports.length === 0 ? (
        <Card className="border-dashed bg-transparent ring-0 shadow-none">
          <CardHeader className="items-center text-center">
            <CardDescription>
              Nenhum plano de produção para exibir. Cadastre um plano de
              produção para começar.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          {totals && (
            <section className="flex flex-col gap-3">
              <h3 className="text-lg font-semibold tracking-tight">
                Consolidado
              </h3>
              <p className="-mt-1 text-sm text-muted-foreground">
                Soma de {withComparison.length}{" "}
                {withComparison.length === 1 ? "plano" : "planos"} de produção.
              </p>
              <ComparisonSummary comparison={totals} />
            </section>
          )}

          {withComparison.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Previsto vs Realizado por plano</CardTitle>
                <CardDescription>
                  Comparação da colheita prevista e realizada de cada cultivo.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm bg-primary/15 ring-1 ring-primary/30" />
                    Previsto
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm bg-primary" />
                    Realizado
                  </span>
                </div>

                <div className="flex flex-col gap-3">
                  {withComparison.map(({ plan, comparison }) => (
                    <div key={plan.id} className="flex flex-col gap-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-medium text-foreground">
                          {plan.crop
                            ? `${plan.crop.name} — ${plan.crop.variety}`
                            : "Plano"}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                          {formatNumber(comparison.totalActualYield)} /{" "}
                          {formatNumber(comparison.expectedYield)} t
                        </span>
                      </div>
                      <div className="relative h-7 w-full overflow-hidden rounded-md bg-muted">
                        <div
                          className="absolute inset-y-0 left-0 rounded-md bg-primary/15 ring-1 ring-inset ring-primary/25"
                          style={{
                            width: `${(comparison.expectedYield / chartMax) * 100}%`,
                          }}
                        />
                        <div
                          className="absolute inset-y-1 left-0 rounded-sm bg-primary transition-all"
                          style={{
                            width: `${(comparison.totalActualYield / chartMax) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {reports.map(({ plan, comparison }) => {
              const percentage = comparison?.percentageRealized ?? 0;
              return (
                <Card key={plan.id}>
                  <CardHeader>
                    <CardTitle className="truncate">
                      {plan.crop
                        ? `${plan.crop.name} — ${plan.crop.variety}`
                        : "Plano"}
                    </CardTitle>
                    <CardDescription>
                      Safra {plan.harvest?.label ?? "—"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    {comparison ? (
                      <>
                        <div className="flex items-baseline justify-between">
                          <span className="text-3xl font-semibold tabular-nums text-primary">
                            {formatNumber(percentage)}%
                          </span>
                          <span className="text-xs text-muted-foreground">
                            da meta
                          </span>
                        </div>
                        <div
                          className="h-2 w-full overflow-hidden rounded-full bg-muted"
                          role="progressbar"
                          aria-valuenow={Math.round(percentage)}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{
                              width: `${Math.max(0, Math.min(100, percentage))}%`,
                            }}
                          />
                        </div>
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>
                            Realizado{" "}
                            <span className="font-medium text-foreground tabular-nums">
                              {formatNumber(comparison.totalActualYield)} t
                            </span>
                          </span>
                          <span>
                            Previsto{" "}
                            <span className="font-medium text-foreground tabular-nums">
                              {formatNumber(comparison.expectedYield)} t
                            </span>
                          </span>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Comparativo indisponível.
                      </p>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      nativeButton={false}
                      className="mt-1 self-start"
                      render={
                        <Link href={`/admin/cultivos/${plan.id}`}>
                          Ver detalhes
                          <ArrowRight />
                        </Link>
                      }
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
