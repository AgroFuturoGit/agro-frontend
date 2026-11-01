"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  MessageSquareWarning,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
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
import { unitLabel } from "@/lib/crops";
import { getMyProducer, listProducers, producerDisplayName } from "@/lib/producers";
import {
  PLAN_STATUS_LABELS,
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
import {
  ExecutionDecisionDialog,
  type DecisionMode,
} from "./execution-decision-dialog";
import { ExecutionFormDrawer } from "./execution-form-drawer";
import { ExecutionOccurrencesSheet } from "./execution-occurrences-sheet";
import { ExecutionStatusBadge } from "./execution-status-badge";
import { ContinuousHarvestChart } from "./harvest-timeline-chart";

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

// Matriz de ações por role × status (segue o back `develop`):
// - PENDING: ADMIN/TECHNICIAN/FARMER editam e excluem; ADMIN/TECHNICIAN/MANAGER
//   decidem (validar/rejeitar).
// - REJECTED: só o FARMER edita (correção — mudar quantidade/data volta para
//   PENDING no back); ninguém exclui.
// - VALIDATED: travado para todos (mudar a quantidade alteraria o realizado
//   sem nova validação, CR-003).
function canEditExecution(role: Role | null, execution: ProductionExecution) {
  if (execution.status === "PENDING") {
    return role === "ADMIN" || role === "TECHNICIAN" || role === "FARMER";
  }
  if (execution.status === "REJECTED") return role === "FARMER";
  return false;
}

function canDeleteExecution(role: Role | null, execution: ProductionExecution) {
  return (
    execution.status === "PENDING" &&
    (role === "ADMIN" || role === "TECHNICIAN" || role === "FARMER")
  );
}

function canDecideExecution(role: Role | null, execution: ProductionExecution) {
  return (
    execution.status === "PENDING" &&
    (role === "ADMIN" || role === "TECHNICIAN" || role === "MANAGER")
  );
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Só o GET do próprio plano respondendo 404 indica plano inexistente. */
function isPlanNotFound(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404;
}

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
  // Id inexistente (404 do GET do plano) ou fora do formato UUID: tela amigável.
  const [notFound, setNotFound] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ProductionExecution | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<ProductionExecution | null>(
    null,
  );
  const [occurrencesTarget, setOccurrencesTarget] =
    useState<ProductionExecution | null>(null);
  const [decision, setDecision] = useState<{
    mode: DecisionMode;
    execution: ProductionExecution;
  } | null>(null);

  // Mais recente primeiro — mesma ordem da tabela manual anterior.
  const [sorting, setSorting] = useState<SortingState>([
    { id: "harvestedAt", desc: true },
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
              producerDisplayName(producer),
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
            producerDisplayName(producer),
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
  // Validar/rejeitar: `@PreAuthorize` de `POST /production-executions/{id}/validate`
  // e `/reject` é ADMIN/TECHNICIAN/MANAGER. Role null (primeiro render) → false.
  const canDecide =
    currentRole === "ADMIN" ||
    currentRole === "TECHNICIAN" ||
    currentRole === "MANAGER";

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    if (!UUID_PATTERN.test(planId)) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    let planFailed = false;
    try {
      const [planData, comparisonData, executionsData] = await Promise.all([
        getProductionPlan(planId).catch((err: unknown) => {
          planFailed = true;
          throw err;
        }),
        getProductionComparison(planId),
        listProductionExecutions(planId),
      ]);
      setPlan(planData);
      setComparison(comparisonData);
      setExecutions(executionsData);
    } catch (err) {
      if (planFailed && isPlanNotFound(err)) {
        setNotFound(true);
        return;
      }
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

  const cropUnit = plan?.crop?.unit ?? null;
  const formatQuantity = useCallback(
    (quantity: number) =>
      `${formatNumber(quantity)} ${unitLabel(cropUnit, quantity)}`,
    [cropUnit],
  );

  const columns = useMemo(() => {
    const baseColumns = [
      // ISO `YYYY-MM-DD`: a comparação lexicográfica já ordena por data.
      columnHelper.accessor((execution) => execution.harvestedAt ?? "", {
        id: "harvestedAt",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Data da colheita"
            disabled={loading}
          />
        ),
        cell: ({ row }) => (
          <span className="font-medium text-foreground">
            {formatPlanDate(row.original.harvestedAt)}
          </span>
        ),
      }),
      columnHelper.accessor("quantity", {
        header: ({ column }) => (
          <div className="flex justify-end">
            <DataTableColumnHeader
              column={column}
              title="Quantidade"
              disabled={loading}
            />
          </div>
        ),
        cell: ({ row }) => (
          <span className="block text-right tabular-nums">
            {formatQuantity(row.original.quantity)}
          </span>
        ),
      }),
      columnHelper.accessor("quantityKg", {
        header: ({ column }) => (
          <div className="flex justify-end">
            <DataTableColumnHeader
              column={column}
              title="Peso (kg)"
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
      columnHelper.accessor((execution) => execution.status ?? "", {
        id: "status",
        header: "Status",
        enableSorting: false,
        cell: ({ row }) => (
          <ExecutionStatusBadge
            status={row.original.status}
            rejectionReason={row.original.rejectionReason}
            decidedAt={row.original.validatedAt}
          />
        ),
      }),
    ];

    const actionsColumn = columnHelper.display({
      id: "actions",
      // Só "Ocorrências" (leitura, 4 roles) ⇒ o cabeçalho não sugere escrita.
      header: canWrite || canDecide ? "Ações" : "Ocorrências",
      cell: ({ row }) => {
        const execution = row.original;
        const edit = canEditExecution(currentRole, execution);
        const remove = canDelete && canDeleteExecution(currentRole, execution);
        const decide = canDecideExecution(currentRole, execution);
        return (
          <div className="inline-flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Ocorrências do apontamento"
              title="Ocorrências"
              onClick={() => setOccurrencesTarget(execution)}
            >
              <MessageSquareWarning />
            </Button>
            {decide && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Validar apontamento"
                  onClick={() => setDecision({ mode: "validate", execution })}
                  className="text-primary hover:text-primary"
                >
                  <Check />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Rejeitar apontamento"
                  onClick={() => setDecision({ mode: "reject", execution })}
                  className="text-destructive hover:text-destructive"
                >
                  <X />
                </Button>
              </>
            )}
            {edit && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Editar apontamento"
                onClick={() => setEditTarget(execution)}
              >
                <Pencil />
              </Button>
            )}
            {remove && (
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
            )}
          </div>
        );
      },
    });

    // "Ocorrências" é leitura liberada às 4 roles: a coluna sempre existe.
    return [...baseColumns, actionsColumn] as ColumnDef<
      ProductionExecution,
      unknown
    >[];
  }, [canWrite, canDelete, canDecide, currentRole, loading, formatQuantity]);

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
    const edit = canEditExecution(currentRole, execution);
    const remove = canDelete && canDeleteExecution(currentRole, execution);
    const decide = canDecideExecution(currentRole, execution);
    return (
      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground">
              {formatPlanDate(execution.harvestedAt)}
            </p>
            <p className="mt-1 text-sm tabular-nums text-muted-foreground">
              {formatQuantity(execution.quantity)} ·{" "}
              {formatNumber(execution.quantityKg)} kg
            </p>
            <div className="mt-1">
              <ExecutionStatusBadge
                status={execution.status}
                rejectionReason={execution.rejectionReason}
                decidedAt={execution.validatedAt}
              />
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOccurrencesTarget(execution)}
            >
              <MessageSquareWarning />
              Ocorrências
            </Button>
            {decide && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDecision({ mode: "validate", execution })}
                >
                  <Check />
                  Validar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDecision({ mode: "reject", execution })}
                >
                  <X />
                  Rejeitar
                </Button>
              </>
            )}
            {edit && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditTarget(execution)}
              >
                <Pencil />
                Editar
              </Button>
            )}
            {remove && (
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
        </div>
      </Card>
    );
  }

  const backToPlansHref = `/admin/organizacoes/${orgId}/comunidades/${communityId}/produtores/${producerId}`;

  if (notFound) {
    return (
      <div className="flex flex-col gap-6">
        <div
          role="alert"
          className="flex flex-col items-start gap-3 rounded-xl border bg-card px-6 py-8"
        >
          <h2 className="text-2xl font-semibold tracking-tight">
            Plano não encontrado
          </h2>
          <p className="text-sm text-muted-foreground">
            O plano de produção não existe ou o endereço está incorreto.
          </p>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={
              <Link href={backToPlansHref}>
                <ArrowLeft />
                Voltar para planos
              </Link>
            }
          />
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
              {plan.status && <> · {PLAN_STATUS_LABELS[plan.status]}</>}
              {(plan.expectedHarvestStart || plan.expectedHarvestEnd) && (
                <>
                  {" "}
                  · Colheita prevista{" "}
                  {formatPlanDate(plan.expectedHarvestStart)} a{" "}
                  {formatPlanDate(plan.expectedHarvestEnd)}
                </>
              )}
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

      {/* Mesmos dados já carregados pela tela — sem chamada extra (AC-015). */}
      {loading ? (
        <Skeleton className="h-80 w-full rounded-xl" />
      ) : (
        plan && <ContinuousHarvestChart plan={plan} executions={executions} />
      )}

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold tracking-tight">
              Apontamentos de colheita
            </h3>
            <p className="text-sm text-muted-foreground">
              Histórico diário do que foi colhido em campo. Somente apontamentos
              validados contam no realizado.
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
          onEmptyAction={
            canWrite && plan ? () => setCreateOpen(true) : undefined
          }
          renderMobileCard={renderMobileCard}
        />

        <DataTablePagination table={table} />
      </div>

      <ExecutionOccurrencesSheet
        execution={occurrencesTarget}
        open={occurrencesTarget !== null}
        onOpenChange={(open) => {
          if (!open) setOccurrencesTarget(null);
        }}
        canWrite={canWrite}
      />

      {canWrite && (
        <>
          <ExecutionFormDrawer
            mode="create"
            planId={planId}
            crop={plan?.crop ?? null}
            open={createOpen}
            onOpenChange={setCreateOpen}
            onSaved={refresh}
          />

          <ExecutionFormDrawer
            mode="edit"
            planId={planId}
            crop={plan?.crop ?? null}
            execution={editTarget}
            open={editTarget !== null}
            onOpenChange={(open) => {
              if (!open) setEditTarget(null);
            }}
            onSaved={refresh}
          />
        </>
      )}

      {canDecide && (
        <ExecutionDecisionDialog
          mode={decision?.mode ?? "validate"}
          execution={decision?.execution ?? null}
          unit={cropUnit}
          open={decision !== null}
          onOpenChange={(open) => {
            if (!open) setDecision(null);
          }}
          onDecided={refresh}
        />
      )}

      {canDelete && (
        <DeleteExecutionDialog
          execution={deleteTarget}
          unit={cropUnit}
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
