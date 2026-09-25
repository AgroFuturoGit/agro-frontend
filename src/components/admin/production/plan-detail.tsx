"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import {
  createColumnHelper,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type Row,
  type SortingState,
} from "@tanstack/react-table";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
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
  getProductionComparison,
  getProductionPlan,
  listProductionExecutions,
  type ProductionComparison,
  type ProductionExecution,
  type ProductionPlan,
} from "@/lib/production";

import { ComparisonSummary } from "./comparison-summary";
import { DeleteExecutionDialog } from "./delete-execution-dialog";
import { ExecutionFormDrawer } from "./execution-form-drawer";

type Props = {
  orgId: string;
  communityId: string;
  producerId: string;
  planId: string;
};

type BreadcrumbNames = {
  organizationName: string;
  communityName: string;
  producerLabel: string;
};

const columnHelper = createColumnHelper<ProductionExecution>();

export function PlanDetail({ orgId, communityId, producerId, planId }: Props) {
  const [currentRole, setCurrentRole] = useState<Role | null>(null);
  const [names, setNames] = useState<BreadcrumbNames | null>(null);
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

  // Mais recente primeiro — mesma ordem da tabela manual anterior.
  const [sorting, setSorting] = useState<SortingState>([
    { id: "harvestDate", desc: true },
  ]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  useEffect(() => {
    setCurrentRole(readUserFromStorage()?.role ?? null);
  }, []);

  // Resolução dos nomes do breadcrumb — best-effort e independente dos 3 GET
  // principais da tela (que já são liberados às 4 roles). FARMER usa
  // `GET /farmers/me` (já traz comunidade+organização aninhadas); as
  // demais roles usam `GET /communities/{id}` + `GET /farmers`, ambos
  // `hasRole('MANAGER') or hasRole('ADMIN')` no backend — se recusarem (ex.
  // TECHNICIAN), o breadcrumb cai em rótulos genéricos sem bloquear o resto
  // da tela.
  useEffect(() => {
    if (currentRole === null) return;
    let active = true;

    async function resolveNames() {
      try {
        if (currentRole === "FARMER") {
          const producer = await getMyProducer();
          if (!active) return;
          setNames({
            organizationName:
              producer.community?.organization?.name ?? "Organização",
            communityName: producer.community?.name ?? "Comunidade",
            producerLabel:
              producer.user?.fullName ?? producer.aliasName ?? "Agricultor",
          });
          return;
        }

        const [community, producers] = await Promise.all([
          getCommunity(communityId),
          listProducers(communityId),
        ]);
        if (!active) return;
        const producer = producers.find((item) => item.id === producerId);
        setNames({
          organizationName: community.organization.name,
          communityName: community.name,
          producerLabel:
            producer?.user?.fullName ?? producer?.aliasName ?? "Agricultor",
        });
      } catch {
        if (active) {
          setNames({
            organizationName: "Organização",
            communityName: "Comunidade",
            producerLabel: "Agricultor",
          });
        }
      }
    }

    resolveNames();
    return () => {
      active = false;
    };
  }, [currentRole, communityId, producerId]);

  // Os 3 GET desta tela (plano, comparativo e execuções) estão liberados para
  // ADMIN/MANAGER/TECHNICIAN/FARMER. Para escrita, o backend real
  // (@PreAuthorize em ProductionController) aceita ADMIN/TECHNICIAN/FARMER
  // em create/update de apontamento — e também em delete
  // (`hasAnyRole('ADMIN', 'TECHNICIAN', 'FARMER')` em
  // `DELETE /production-executions/{executionId}`).
  //
  // OWNERSHIP VERIFICADO contra o backend REAL em 2026-09-17: autenticado
  // como o agricultor A, `DELETE /production-executions/{apontamento_de_B}`
  // devolveu 403 ("O agricultor só tem acesso aos seus próprios dados de
  // produção") e `DELETE /production-executions/{apontamento_de_A}` devolveu
  // 204, com o apontamento sumindo na releitura. A tabela completa das 4
  // chamadas está no comentário equivalente de `producer-plans-page.tsx`.
  // Por isso o FARMER entra no `canDelete` abaixo.
  //
  // RN4: no primeiro render a role ainda é null, então nada de escrita
  // renderiza (falha fechado).
  const canWrite =
    currentRole === "FARMER" ||
    currentRole === "ADMIN" ||
    currentRole === "TECHNICIAN";
  // Mesmo conjunto de roles da escrita em geral; mantido como constante
  // própria porque é o gate citado nos testes desta tela.
  const canDelete = canWrite;

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
    refresh();
  }, [refresh]);

  const columns = useMemo(() => {
    const baseColumns = [
      // ISO `YYYY-MM-DD`: a comparação lexicográfica já ordena por data.
      columnHelper.accessor((execution) => execution.harvestDate ?? "", {
        id: "harvestDate",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Data da colheita"
            disabled={loading}
          />
        ),
        cell: ({ row }) => (
          <span className="font-medium text-foreground">
            {formatPlanDate(row.original.harvestDate)}
          </span>
        ),
      }),
      columnHelper.accessor("actualYield", {
        header: ({ column }) => (
          <div className="flex justify-end">
            <DataTableColumnHeader
              column={column}
              title="Quantidade (t)"
              disabled={loading}
            />
          </div>
        ),
        cell: (info) => (
          <span className="block text-right tabular-nums">
            {formatNumber(info.getValue())}
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
            aria-label="Editar apontamento"
            onClick={() => setEditTarget(row.original)}
          >
            <Pencil />
          </Button>
          {canDelete && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Excluir apontamento"
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
      ProductionExecution,
      unknown
    >[];
  }, [canWrite, canDelete, loading]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: executions,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  function renderMobileCard(row: Row<ProductionExecution>) {
    const execution = row.original;
    return (
      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground">
              {formatPlanDate(execution.harvestDate)}
            </p>
            <p className="mt-1 text-sm tabular-nums text-muted-foreground">
              {formatNumber(execution.actualYield)} t colhidas
            </p>
          </div>
          {canWrite && (
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditTarget(execution)}
              >
                <Pencil />
                Editar
              </Button>
              {canDelete && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="Excluir apontamento"
                  onClick={() => setDeleteTarget(execution)}
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

  const backToPlansHref = `/admin/organizacoes/${orgId}/comunidades/${communityId}/produtores/${producerId}`;

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
          {
            label: names?.producerLabel ?? "Agricultor",
            href: backToPlansHref,
          },
          {
            label:
              !loading && plan?.crop
                ? `${plan.crop.name} — ${plan.crop.variety}`
                : "Plano de produção",
          },
        ]}
      />

      <div>
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          className="-ml-2 mb-2 text-muted-foreground"
          render={
            <Link href={backToPlansHref}>
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
          {canWrite && plan && (
            <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus />
              Novo apontamento
            </Button>
          )}
        </div>

        {/*
          Erro de carregamento é da tela inteira (plano, comparativo e
          apontamentos vêm juntos) e já aparece no alerta do topo — por isso
          o DataTable não recebe `hasError`.
        */}
        <DataTable
          table={table}
          columns={columns}
          isLoading={loading}
          emptyTitle="Nenhum apontamento registrado ainda."
          emptyActionLabel={
            canWrite && plan ? "Registrar primeira colheita" : undefined
          }
          onEmptyAction={canWrite && plan ? () => setCreateOpen(true) : undefined}
          renderMobileCard={renderMobileCard}
        />

        <DataTablePagination table={table} />
      </div>

      {canWrite && (
        <>
          <ExecutionFormDrawer
            mode="create"
            planId={planId}
            open={createOpen}
            onOpenChange={setCreateOpen}
            onSaved={refresh}
          />

          <ExecutionFormDrawer
            mode="edit"
            planId={planId}
            execution={editTarget}
            open={editTarget !== null}
            onOpenChange={(open) => {
              if (!open) setEditTarget(null);
            }}
            onSaved={refresh}
          />
        </>
      )}

      {canDelete && (
        <DeleteExecutionDialog
          execution={deleteTarget}
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
