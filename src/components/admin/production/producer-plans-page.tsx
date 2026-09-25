"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Pencil, Plus, Trash2 } from "lucide-react";
import {
  createColumnHelper,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type PaginationState,
  type Row,
  type SortingState,
} from "@tanstack/react-table";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import { PlanFormDrawer } from "./plan-form-drawer";

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

function cropLabel(plan: ProductionPlan): string {
  return plan.crop ? `${plan.crop.name} — ${plan.crop.variety}` : "";
}

/** Busca livre por cultivo, variedade ou safra, case-insensitive. */
function plansGlobalFilter(
  row: Row<ProductionPlan>,
  _columnId: string,
  filterValue: string,
) {
  const query = filterValue.trim().toLowerCase();
  if (!query) return true;
  const plan = row.original;
  return [cropLabel(plan), plan.harvest?.label].some((value) =>
    value?.toLowerCase().includes(query),
  );
}

const columnHelper = createColumnHelper<ProductionPlan>();

export function ProducerPlansPage({ orgId, communityId, producerId }: Props) {
  const router = useRouter();

  const [currentRole, setCurrentRole] = useState<Role | null>(null);
  const [roleResolved, setRoleResolved] = useState(false);

  // Guarda de ownership do FARMER: o backend não impõe escopo hierárquico em
  // toda rota, então a UI nunca deixa um agricultor abrir os dados de outro.
  // Falha fechada até o próprio agricultor ser confirmado.
  const [guardPassed, setGuardPassed] = useState(false);
  const [guardError, setGuardError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  // Nomes do breadcrumb são resolvidos à parte da listagem de planos: em
  // TECHNICIAN, por exemplo, `GET /communities/{id}` e `GET /farmers`
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

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  useEffect(() => {
    setCurrentRole(readUserFromStorage()?.role ?? null);
    setRoleResolved(true);
  }, []);

  // Backend real (@PreAuthorize em ProductionController): create/update de
  // plano aceitam ADMIN, TECHNICIAN e FARMER — e o delete aceita essas
  // mesmas 3 roles (`hasAnyRole('ADMIN', 'TECHNICIAN', 'FARMER')`), desde o
  // commit `e7930c8` do backend ("allow the producer to delete their
  // production plans").
  //
  // OWNERSHIP VERIFICADO contra o backend REAL em 2026-09-17, antes de
  // liberar a afordância — o backend não garante escopo hierárquico em toda
  // rota, então isso se mede, não se presume. Cenário: dois agricultores A e
  // B na mesma comunidade, cada um com um plano e um apontamento próprios;
  // autenticado como A:
  //
  //   DELETE /production-plans/{plano_de_B}          → 403
  //   DELETE /production-executions/{apontamento_B}  → 403
  //   DELETE /production-executions/{apontamento_A}  → 204 (some na releitura)
  //   DELETE /production-plans/{plano_de_A}          → 204 (some na releitura)
  //
  // Os 403 vêm do próprio Use Case ("O agricultor só tem acesso aos seus
  // próprios dados de produção"), não apenas do `@PreAuthorize`. Checar as
  // duas camadas importa: já houve caso neste projeto em que a validação
  // interna do Use Case era mais restritiva que o `@PreAuthorize` do
  // controller, e nenhuma suíte mockada pegou. Aqui elas concordam, por isso
  // o FARMER entra no `canDelete` abaixo.
  //
  // RN4 preservada: enquanto a role for desconhecida, nenhuma afordância de
  // escrita renderiza.
  const canWrite =
    currentRole === "FARMER" ||
    currentRole === "ADMIN" ||
    currentRole === "TECHNICIAN";
  // Mesmo conjunto de roles da escrita em geral; mantido como constante
  // própria porque é o gate citado nos testes desta tela.
  const canDelete = canWrite;

  const runGuard = useCallback(async () => {
    if (!roleResolved) return;

    if (currentRole !== "FARMER") {
      setGuardPassed(true);
      return;
    }

    setGuardError(null);
    try {
      const producer = await getMyProducer();
      if (producer.id !== producerId) {
        // FARMER tentando abrir a URL de outro produtor: nunca deixamos os
        // dados dele chegarem a renderizar — redireciona para a resolução
        // automática do próprio recurso.
        setRedirecting(true);
        router.replace("/admin/organizacoes");
        return;
      }
      setNames({
        organizationName: producer.community?.organization?.name ?? "Organização",
        communityName: producer.community?.name ?? "Comunidade",
        producerLabel: producer.user?.fullName ?? producer.aliasName ?? "Agricultor",
      });
      setGuardPassed(true);
    } catch (err) {
      setGuardError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível verificar o acesso a este agricultor.",
      );
    }
  }, [roleResolved, currentRole, producerId, router]);

  useEffect(() => {
    runGuard();
  }, [runGuard]);

  // Resolve nomes do breadcrumb para quem não é FARMER (o FARMER já
  // resolve tudo dentro da guarda acima, sem chamada extra).
  useEffect(() => {
    if (!guardPassed || currentRole === "FARMER") return;
    let active = true;

    Promise.all([getCommunity(communityId), listProducers(communityId)])
      .then(([community, producers]) => {
        if (!active) return;
        const producer = producers.find((item) => item.id === producerId);
        setNames({
          organizationName: community.organization.name,
          communityName: community.name,
          producerLabel:
            producer?.user?.fullName ?? producer?.aliasName ?? "Agricultor",
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
            producerLabel: "Agricultor",
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
    refresh();
  }, [refresh]);

  const planHref = useCallback(
    (plan: ProductionPlan) =>
      `/admin/organizacoes/${orgId}/comunidades/${communityId}/produtores/${producerId}/planos/${plan.id}`,
    [orgId, communityId, producerId],
  );

  const harvestOptions = useMemo(
    () =>
      Array.from(
        new Set(
          plans
            .map((plan) => plan.harvest?.label)
            .filter((label): label is string => Boolean(label)),
        ),
      )
        .sort((a, b) => a.localeCompare(b))
        .map((label) => ({ value: label, label })),
    [plans],
  );

  const columns = useMemo(() => {
    const baseColumns = [
      columnHelper.accessor((plan) => cropLabel(plan), {
        id: "crop",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Cultivo" disabled={loading} />
        ),
        cell: ({ row }) => (
          <Link
            href={planHref(row.original)}
            className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
          >
            {cropLabel(row.original) || "—"}
            <ArrowRight className="size-3.5 text-muted-foreground" />
          </Link>
        ),
      }),
      columnHelper.accessor((plan) => plan.harvest?.label ?? "", {
        id: "harvest",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Safra" disabled={loading} />
        ),
        cell: (info) => (
          <span className="text-muted-foreground">{info.getValue() || "—"}</span>
        ),
        filterFn: (row, columnId, filterValue) =>
          !filterValue || row.getValue(columnId) === filterValue,
      }),
      columnHelper.accessor("plantedArea", {
        header: ({ column }) => (
          <div className="flex justify-end">
            <DataTableColumnHeader column={column} title="Área (ha)" disabled={loading} />
          </div>
        ),
        cell: (info) => (
          <span className="block text-right tabular-nums">
            {formatNumber(info.getValue())}
          </span>
        ),
      }),
      columnHelper.accessor("expectedYield", {
        header: ({ column }) => (
          <div className="flex justify-end">
            <DataTableColumnHeader column={column} title="Previsto (t)" disabled={loading} />
          </div>
        ),
        cell: (info) => (
          <span className="block text-right tabular-nums">
            {formatNumber(info.getValue())}
          </span>
        ),
      }),
      // ISO `YYYY-MM-DD`: a comparação lexicográfica já ordena por data.
      columnHelper.accessor((plan) => plan.plannedPlantingDate ?? "", {
        id: "plannedPlantingDate",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Plantio" disabled={loading} />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatPlanDate(row.original.plannedPlantingDate)}
          </span>
        ),
      }),
    ];

    const actionsColumn = columnHelper.display({
      id: "actions",
      header: "Ações",
      cell: ({ row }) => (
        <div className="inline-flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Editar plano"
            onClick={() => setEditTarget(row.original)}
          >
            <Pencil />
          </Button>
          {canDelete && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Excluir plano"
              onClick={() => setDeleteTarget(row.original)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 />
            </Button>
          )}
        </div>
      ),
    });

    return (canWrite ? [...baseColumns, actionsColumn] : baseColumns) as ColumnDef<
      ProductionPlan,
      unknown
    >[];
  }, [canWrite, canDelete, loading, planHref]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: plans,
    columns,
    state: { sorting, columnFilters, globalFilter, pagination },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    globalFilterFn: plansGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  function renderMobileCard(row: Row<ProductionPlan>) {
    const plan = row.original;
    return (
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Link
              href={planHref(plan)}
              className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
            >
              {cropLabel(plan) || "—"}
              <ArrowRight className="size-3.5 text-muted-foreground" />
            </Link>
            <p className="mt-1 text-sm text-muted-foreground">
              {plan.harvest?.label ?? "—"} · Plantio{" "}
              {formatPlanDate(plan.plannedPlantingDate)}
            </p>
            <p className="mt-1 text-sm tabular-nums">
              {formatNumber(plan.plantedArea)} ha ·{" "}
              {formatNumber(plan.expectedYield)} t previstas
            </p>
          </div>
          {canWrite && (
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditTarget(plan)}
              >
                <Pencil />
                Editar
              </Button>
              {canDelete && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="Excluir plano"
                  onClick={() => setDeleteTarget(plan)}
                >
                  <Trash2 />
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>
    );
  }

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
          { label: names?.producerLabel ?? "Agricultor" },
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

      <DataTableToolbar
        table={table}
        searchPlaceholder="Buscar por cultivo ou safra…"
        filters={[{ columnId: "harvest", label: "Safra", options: harvestOptions }]}
      />

      <DataTable
        table={table}
        columns={columns}
        isLoading={loading}
        hasError={Boolean(error)}
        onRetry={refresh}
        errorHint={error ?? undefined}
        hasActiveFilters={
          Boolean(table.getState().globalFilter) ||
          table.getState().columnFilters.length > 0
        }
        onClearFilters={() => {
          table.setGlobalFilter("");
          table.resetColumnFilters();
        }}
        emptyTitle="Nenhum plano de produção cadastrado ainda."
        emptyActionLabel={canWrite ? "Criar primeiro plano" : undefined}
        onEmptyAction={canWrite ? () => setCreateOpen(true) : undefined}
        renderMobileCard={renderMobileCard}
      />

      <DataTablePagination table={table} />

      {canWrite && guardPassed && (
        <PlanFormDrawer
          mode="create"
          producerId={producerId}
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSaved={refresh}
        />
      )}

      {canWrite && guardPassed && (
        <PlanFormDrawer
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
