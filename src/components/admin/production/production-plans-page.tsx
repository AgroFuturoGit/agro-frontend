"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, Pencil, Plus, Trash2 } from "lucide-react";

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
import { getMyProducer } from "@/lib/producers";
import {
  formatNumber,
  formatPlanDate,
  listProductionPlans,
  type ProductionPlan,
} from "@/lib/production";

import { DeletePlanDialog } from "./delete-plan-dialog";
import { PlanFormDialog } from "./plan-form-dialog";

export function ProductionPlansPage() {
  const [producerId, setProducerId] = useState<string | null>(null);
  const [plans, setPlans] = useState<ProductionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ProductionPlan | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductionPlan | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const producer = await getMyProducer();
      setProducerId(producer.id);
      const data = await listProductionPlans(producer.id);
      setPlans(data);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar os planos de produção.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Planos de produção
          </h2>
          <p className="text-sm text-muted-foreground">
            Planeje suas safras e acompanhe a evolução de cada cultivo.
          </p>
        </div>
        {producerId && (
          <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus />
            Novo plano
          </Button>
        )}
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

      <Card className="py-0">
        <Table>
          <TableHeader className="bg-muted/40 [&_th]:h-11 [&_th]:px-4 [&_th]:text-xs [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground">
            <TableRow className="hover:bg-transparent">
              <TableHead>Cultivo</TableHead>
              <TableHead>Safra</TableHead>
              <TableHead className="text-right">Área (ha)</TableHead>
              <TableHead className="text-right">Previsto (t)</TableHead>
              <TableHead>Plantio</TableHead>
              <TableHead className="w-[1%] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="[&_td]:h-12 [&_td]:px-4">
            {loading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <TableRow key={`skeleton-${idx}`}>
                  {Array.from({ length: 6 }).map((__, cidx) => (
                    <TableCell key={cidx}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : plans.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="py-12 text-center">
                  <p className="text-sm text-muted-foreground">
                    Nenhum plano de produção cadastrado ainda.
                  </p>
                  {producerId && (
                    <Button
                      type="button"
                      size="sm"
                      className="mt-4"
                      onClick={() => setCreateOpen(true)}
                    >
                      Criar primeiro plano
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium text-foreground">
                    <Link
                      href={`/admin/cultivos/${plan.id}`}
                      className="inline-flex items-center gap-1 hover:underline"
                    >
                      {plan.crop
                        ? `${plan.crop.name} — ${plan.crop.variety}`
                        : "—"}
                      <ArrowRight className="size-3.5 text-muted-foreground" />
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {plan.harvest?.label ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(plan.plantedArea)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(plan.expectedYield)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatPlanDate(plan.plannedPlantingDate)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Editar plano"
                        onClick={() => setEditTarget(plan)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Excluir plano"
                        onClick={() => setDeleteTarget(plan)}
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

      {producerId && (
        <PlanFormDialog
          mode="create"
          producerId={producerId}
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSaved={refresh}
        />
      )}

      {producerId && (
        <PlanFormDialog
          mode="edit"
          producerId={producerId}
          plan={editTarget}
          open={editTarget !== null}
          onOpenChange={(open) => {
            if (!open) setEditTarget(null);
          }}
          onSaved={refresh}
        />
      )}

      <DeletePlanDialog
        plan={deleteTarget}
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onDeleted={refresh}
      />
    </div>
  );
}
