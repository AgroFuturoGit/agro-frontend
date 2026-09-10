"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Pencil, Plus, Trash2 } from "lucide-react";

import { Breadcrumb } from "@/components/ui/breadcrumb";
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
import { readUserFromStorage, type Role } from "@/lib/auth";
import { getCommunity } from "@/lib/communities";
import { getMyProducer, listProducers } from "@/lib/producers";
import {
  formatNumber,
  formatPlanDate,
  listProductionPlans,
  type ProductionPlan,
} from "@/lib/production";

import { DeletePlanDialog } from "./delete-plan-dialog";
import { PlanFormDialog } from "./plan-form-dialog";

type Props = {
  orgId: string;
  communityId: string;
  producerId: string;
};

type BreadcrumbNames = {
  organizationName: string;
  communityName: string;
  producerLabel: string;
};

export function ProducerPlansPage({ orgId, communityId, producerId }: Props) {
  const router = useRouter();

  const [currentRole, setCurrentRole] = useState<Role | null>(null);
  const [roleResolved, setRoleResolved] = useState(false);

  // Guarda de ownership do PRODUCER (memória `lesson-backend-hierarchy-
  // ownership`, aplicada ao caso PRODUCER→produtor descrito nas Prohibitions
  // do plano): falha fechada até o próprio produtor ser confirmado.
  const [guardPassed, setGuardPassed] = useState(false);
  const [guardError, setGuardError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  // Nomes do breadcrumb são resolvidos à parte da listagem de planos: em
  // TECHNICIAN, por exemplo, `GET /communities/{id}` e `GET /producers`
  // recusam (`hasRole('MANAGER') or hasRole('ADMIN')` no backend), mas os 3
  // GET de planos de produção continuam liberados às 4 roles. Um breadcrumb
  // com rótulos genéricos não deve impedir a listagem de planos de
  // carregar.
  const [names, setNames] = useState<BreadcrumbNames | null>(null);

  const [plans, setPlans] = useState<ProductionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ProductionPlan | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductionPlan | null>(
    null,
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentRole(readUserFromStorage()?.role ?? null);
    setRoleResolved(true);
  }, []);

  // Backend real (@PreAuthorize em ProductionController): create/update de
  // plano aceitam ADMIN, TECHNICIAN e PRODUCER; delete aceita só ADMIN e
  // TECHNICIAN (PRODUCER recebe 403). RN4 preservada: enquanto a role for
  // desconhecida, nenhuma afordância de escrita renderiza.
  const canWrite =
    currentRole === "PRODUCER" ||
    currentRole === "ADMIN" ||
    currentRole === "TECHNICIAN";
  const canDelete = currentRole === "ADMIN" || currentRole === "TECHNICIAN";
  const columnCount = canWrite ? 6 : 5;

  const runGuard = useCallback(async () => {
    if (!roleResolved) return;

    if (currentRole !== "PRODUCER") {
      setGuardPassed(true);
      return;
    }

    setGuardError(null);
    try {
      const producer = await getMyProducer();
      if (producer.id !== producerId) {
        // PRODUCER tentando abrir a URL de outro produtor: nunca deixamos os
        // dados dele chegarem a renderizar — redireciona para a resolução
        // automática do próprio recurso.
        setRedirecting(true);
        router.replace("/admin/organizacoes");
        return;
      }
      setNames({
        organizationName: producer.community?.organization?.name ?? "Organização",
        communityName: producer.community?.name ?? "Comunidade",
        producerLabel: producer.user?.fullName ?? producer.aliasName ?? "Produtor",
      });
      setGuardPassed(true);
    } catch (err) {
      setGuardError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível verificar o acesso a este produtor.",
      );
    }
  }, [roleResolved, currentRole, producerId, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    runGuard();
  }, [runGuard]);

  // Resolve nomes do breadcrumb para quem não é PRODUCER (o PRODUCER já
  // resolve tudo dentro da guarda acima, sem chamada extra).
  useEffect(() => {
    if (!guardPassed || currentRole === "PRODUCER") return;
    let active = true;

    Promise.all([getCommunity(communityId), listProducers(communityId)])
      .then(([community, producers]) => {
        if (!active) return;
        const producer = producers.find((item) => item.id === producerId);
        setNames({
          organizationName: community.organization.name,
          communityName: community.name,
          producerLabel:
            producer?.user?.fullName ?? producer?.aliasName ?? "Produtor",
        });
      })
      .catch(() => {
        // Best-effort: sem permissão para ler comunidade/produtor (ex.
        // TECHNICIAN contra o backend real) o breadcrumb cai em rótulos
        // genéricos, mas a listagem de planos abaixo segue funcionando.
        if (active) {
          setNames({
            organizationName: "Organização",
            communityName: "Comunidade",
            producerLabel: "Produtor",
          });
        }
      });

    return () => {
      active = false;
    };
  }, [guardPassed, currentRole, communityId, producerId]);

  const refresh = useCallback(async () => {
    if (!guardPassed) return;

    setLoading(true);
    setError(null);
    try {
      const data = await listProductionPlans(producerId);
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
  }, [guardPassed, producerId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  if (redirecting) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (guardError) {
    return (
      <div className="flex flex-col gap-6">
        <div
          role="alert"
          className="flex items-start justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{guardError}</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => runGuard()}
          >
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb
        items={[
          { label: "Organizações", href: "/admin/organizacoes" },
          {
            label: names?.organizationName ?? "Organização",
            href: `/admin/organizacoes/${orgId}`,
          },
          {
            label: names?.communityName ?? "Comunidade",
            href: `/admin/organizacoes/${orgId}/comunidades/${communityId}`,
          },
          { label: names?.producerLabel ?? "Produtor" },
        ]}
      />

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Planos de produção
          </h2>
          <p className="text-sm text-muted-foreground">
            Planos de {names?.producerLabel ?? "produção"}.
          </p>
        </div>
        {canWrite && guardPassed && (
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
              {canWrite && (
                <TableHead className="w-[1%] text-right">Ações</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody className="[&_td]:h-12 [&_td]:px-4">
            {loading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <TableRow key={`skeleton-${idx}`}>
                  {Array.from({ length: columnCount }).map((__, cidx) => (
                    <TableCell key={cidx}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : plans.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columnCount} className="py-12 text-center">
                  <p className="text-sm text-muted-foreground">
                    Nenhum plano de produção cadastrado ainda.
                  </p>
                  {canWrite && (
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
                      href={`/admin/organizacoes/${orgId}/comunidades/${communityId}/produtores/${producerId}/planos/${plan.id}`}
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
                  {canWrite && (
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
                        {canDelete && (
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
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {canWrite && guardPassed && (
        <PlanFormDialog
          mode="create"
          producerId={producerId}
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSaved={refresh}
        />
      )}

      {canWrite && guardPassed && (
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

      {canDelete && (
        <DeletePlanDialog
          plan={deleteTarget}
          open={deleteTarget !== null}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
          onDeleted={refresh}
        />
      )}
    </div>
  );
}
