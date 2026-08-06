"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { readUserFromStorage, type Role } from "@/lib/auth";
import { getMyProducer, listProducers, type Producer } from "@/lib/producers";
import {
  formatNumber,
  formatPlanDate,
  listProductionPlans,
  type ProductionPlan,
} from "@/lib/production";

import { DeletePlanDialog } from "./delete-plan-dialog";
import { PlanFormDialog } from "./plan-form-dialog";

function producerLabel(producer: Producer | undefined | null): string {
  return producer?.user?.fullName ?? producer?.aliasName ?? "—";
}

export function ProductionPlansPage() {
  const [currentRole, setCurrentRole] = useState<Role | null>(null);
  const [producerId, setProducerId] = useState<string | null>(null);
  const [producers, setProducers] = useState<Producer[]>([]);
  const [selectedProducerId, setSelectedProducerId] = useState<string>("");
  const [loadingProducers, setLoadingProducers] = useState(false);
  const [plans, setPlans] = useState<ProductionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ProductionPlan | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductionPlan | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentRole(readUserFromStorage()?.role ?? null);
  }, []);

  const isProducer = currentRole === "PRODUCER";
  // O seletor existe para quem não tem um Producer próprio e só lê os planos
  // de terceiros (MANAGER/TECHNICIAN — e ADMIN, que também acessa a rota).
  // O PRODUCER nunca vê o seletor.
  const showProducerSelect =
    currentRole === "MANAGER" ||
    currentRole === "TECHNICIAN" ||
    currentRole === "ADMIN";

  // Produtor cujos planos estão em tela: o próprio, para PRODUCER; o
  // escolhido no seletor, para as demais roles.
  const activeProducerId = isProducer ? producerId : selectedProducerId || null;

  const loadProducers = useCallback(async () => {
    setLoadingProducers(true);
    try {
      const list = await listProducers();
      setProducers(list);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar os produtores.",
      );
    } finally {
      setLoadingProducers(false);
    }
  }, []);

  useEffect(() => {
    if (!showProducerSelect) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadProducers();
  }, [showProducerSelect, loadProducers]);

  const refresh = useCallback(async () => {
    // RN4: enquanto a role for desconhecida, nenhuma requisição é disparada.
    if (currentRole === null) return;

    // RN6: MANAGER/TECHNICIAN não buscam planos antes de escolher o produtor.
    if (currentRole !== "PRODUCER" && !selectedProducerId) {
      setPlans([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // RN5: caminho do PRODUCER preservado — /producers/me e, em seguida,
      // os planos do próprio produtor.
      if (currentRole === "PRODUCER") {
        const producer = await getMyProducer();
        setProducerId(producer.id);
        const data = await listProductionPlans(producer.id);
        setPlans(data);
      } else {
        const data = await listProductionPlans(selectedProducerId);
        setPlans(data);
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar os planos de produção.",
      );
    } finally {
      setLoading(false);
    }
  }, [currentRole, selectedProducerId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const handleRetry = useCallback(() => {
    setError(null);
    if (showProducerSelect) loadProducers();
    refresh();
  }, [showProducerSelect, loadProducers, refresh]);

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
        {showProducerSelect && (
          <div className="flex w-full flex-col gap-2 md:w-72">
            <Label htmlFor="plans-producer">Produtor</Label>
            <Select
              value={selectedProducerId}
              onValueChange={(value) => setSelectedProducerId(value ?? "")}
              disabled={loadingProducers}
            >
              <SelectTrigger id="plans-producer" className="w-full">
                <SelectValue
                  placeholder={
                    loadingProducers ? "Carregando…" : "Escolha um produtor"
                  }
                >
                  {(value) =>
                    producers.some((producer) => producer.id === value)
                      ? producerLabel(
                          producers.find((producer) => producer.id === value),
                        )
                      : "Escolha um produtor"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {producers.map((producer) => (
                  <SelectItem key={producer.id} value={producer.id}>
                    {producerLabel(producer)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {/* Criar plano continua sendo hasRole('PRODUCER') no backend — o botão
            não pode aparecer para MANAGER/TECHNICIAN/ADMIN. */}
        {isProducer && producerId && (
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
            onClick={() => handleRetry()}
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
            ) : showProducerSelect && !selectedProducerId ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={6}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  Selecione um produtor para ver os planos de produção
                </TableCell>
              </TableRow>
            ) : plans.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="py-12 text-center">
                  <p className="text-sm text-muted-foreground">
                    Nenhum plano de produção cadastrado ainda.
                  </p>
                  {isProducer && producerId && (
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

      {isProducer && producerId && (
        <PlanFormDialog
          mode="create"
          producerId={producerId}
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSaved={refresh}
        />
      )}

      {activeProducerId && (
        <PlanFormDialog
          mode="edit"
          producerId={activeProducerId}
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
