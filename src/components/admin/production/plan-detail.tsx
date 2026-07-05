"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError } from "@/lib/api";
import {
  formatNumber,
  formatPlanDate,
  getProductionComparison,
  getProductionPlan,
  listProductionExecutions,
  type ProductionComparison,
  type ProductionExecution,
  type ProductionPlan,
} from "@/lib/production";

import { ComparisonSummary } from "./comparison-summary";
import { DeleteExecutionDialog } from "./delete-execution-dialog";
import { ExecutionFormDialog } from "./execution-form-dialog";

type Props = {
  planId: string;
};

export function PlanDetail({ planId }: Props) {
  const [plan, setPlan] = useState<ProductionPlan | null>(null);
  const [comparison, setComparison] = useState<ProductionComparison | null>(
    null,
  );
  const [executions, setExecutions] = useState<ProductionExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ProductionExecution | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductionExecution | null>(
    null,
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [planData, comparisonData, executionsData] = await Promise.all([
        getProductionPlan(planId),
        getProductionComparison(planId),
        listProductionExecutions(planId),
      ]);
      setPlan(planData);
      setComparison(comparisonData);
      setExecutions(executionsData);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar o plano de produção.",
      );
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const sortedExecutions = [...executions].sort((a, b) =>
    (b.harvestDate ?? "").localeCompare(a.harvestDate ?? ""),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          className="-ml-2 mb-2 text-muted-foreground"
          render={
            <Link href="/admin/cultivos">
              <ArrowLeft />
              Voltar para planos
            </Link>
          }
        />
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight">
            {loading ? (
              <Skeleton className="h-7 w-64" />
            ) : plan?.crop ? (
              `${plan.crop.name} — ${plan.crop.variety}`
            ) : (
              "Plano de produção"
            )}
          </h2>
          {!loading && plan && (
            <p className="text-sm text-muted-foreground">
              Safra {plan.harvest?.label ?? "—"} · Área{" "}
              {formatNumber(plan.plantedArea)} ha · Plantio{" "}
              {formatPlanDate(plan.plannedPlantingDate)}
            </p>
          )}
        </div>
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
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : (
        comparison && <ComparisonSummary comparison={comparison} />
      )}

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold tracking-tight">
              Apontamentos de colheita
            </h3>
            <p className="text-sm text-muted-foreground">
              Histórico diário do que foi colhido em campo.
            </p>
          </div>
          {plan && (
            <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus />
              Novo apontamento
            </Button>
          )}
        </div>

        <Card className="py-0">
          <Table>
            <TableHeader className="bg-muted/40 [&_th]:h-11 [&_th]:px-4 [&_th]:text-xs [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground">
              <TableRow className="hover:bg-transparent">
                <TableHead>Data da colheita</TableHead>
                <TableHead className="text-right">Quantidade (t)</TableHead>
                <TableHead className="w-[1%] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="[&_td]:h-12 [&_td]:px-4">
              {loading ? (
                Array.from({ length: 3 }).map((_, idx) => (
                  <TableRow key={`skeleton-${idx}`}>
                    {Array.from({ length: 3 }).map((__, cidx) => (
                      <TableCell key={cidx}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : sortedExecutions.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={3} className="py-12 text-center">
                    <p className="text-sm text-muted-foreground">
                      Nenhum apontamento registrado ainda.
                    </p>
                    {plan && (
                      <Button
                        type="button"
                        size="sm"
                        className="mt-4"
                        onClick={() => setCreateOpen(true)}
                      >
                        Registrar primeira colheita
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                sortedExecutions.map((execution) => (
                  <TableRow key={execution.id}>
                    <TableCell className="font-medium text-foreground">
                      {formatPlanDate(execution.harvestDate)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(execution.actualYield)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Editar apontamento"
                          onClick={() => setEditTarget(execution)}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Excluir apontamento"
                          onClick={() => setDeleteTarget(execution)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      <ExecutionFormDialog
        mode="create"
        planId={planId}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={refresh}
      />

      <ExecutionFormDialog
        mode="edit"
        planId={planId}
        execution={editTarget}
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        onSaved={refresh}
      />

      <DeleteExecutionDialog
        execution={deleteTarget}
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onDeleted={refresh}
      />
    </div>
  );
}
