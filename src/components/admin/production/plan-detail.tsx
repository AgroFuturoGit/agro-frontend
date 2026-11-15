"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  FileQuestion,
  Images,
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

import { BackLink } from "@/components/admin/back-link";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { SectionHeader } from "@/components/admin/section-header";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import {
  DataTableRowActions,
  type DataTableRowAction,
} from "@/components/data-table/data-table-row-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InlineAlert } from "@/components/ui/inline-alert";
import { ApiError, userFacingErrorHint } from "@/lib/api";
import { PLAN_STATUS_VARIANT } from "@/lib/status-variants";
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
import { ExecutionAttachmentsSheet } from "./execution-attachments-sheet";
import { ExecutionOccurrencesSheet } from "./execution-occurrences-sheet";
import { ExecutionStatusBadge } from "./execution-status-badge";
import {
  ContinuousHarvestChart,
  HarvestChartSkeleton,
} from "./harvest-timeline-chart";

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

// Fotos e ocorrências: o back recusa (403) a escrita do FARMER em apontamento
// VALIDATED; ADMIN e TECHNICIAN seguem podendo complementar a evidência.
function canWriteEvidence(role: Role | null, execution: ProductionExecution | null) {
  if (role === "FARMER") return execution?.status !== "VALIDATED";
  return role === "ADMIN" || role === "TECHNICIAN";
}

/** Rótulos de safra costumam já começar com "Safra": evita "Safra Safra 2026". */
function harvestText(label: string | null | undefined): string {
  const value = label?.trim();
  if (!value) return "Safra —";
  return /^safra\b/i.test(value) ? value : `Safra ${value}`;
}

/**
 * Metadados do plano no PageHeader: cada par fica inteiro na mesma linha
 * (a quebra acontece só entre itens) e o status usa o mesmo Badge da lista
 * de planos.
 */
function PlanMeta({ plan }: { plan: ProductionPlan }) {
  const items: string[] = [
    harvestText(plan.harvest?.label),
    `Área ${formatNumber(plan.plantedArea)} ha`,
    `Plantio ${formatPlanDate(plan.plannedPlantingDate)}`,
  ];
  if (plan.expectedHarvestStart || plan.expectedHarvestEnd) {
    items.push(
      `Colheita prevista ${formatPlanDate(plan.expectedHarvestStart)} a ${formatPlanDate(plan.expectedHarvestEnd)}`,
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      {items.map((item, index) => (
        <span key={item} className="whitespace-nowrap">
          {index > 0 ? (
            <span aria-hidden="true" className="mr-2">
              ·
            </span>
          ) : null}
          {item}
        </span>
      ))}
      {plan.status ? (
        <Badge variant={PLAN_STATUS_VARIANT[plan.status]}>
          {PLAN_STATUS_LABELS[plan.status]}
        </Badge>
      ) : null}
    </span>
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
  const [attachmentsTarget, setAttachmentsTarget] =
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
      // "Erro 500" cru não ajuda: cai na mensagem genérica.
      setError(
        (err instanceof ApiError ? userFacingErrorHint(err.message) : undefined) ??
          "Não foi possível carregar o plano de produção.",
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

  // Ações de linha (desktop): mesma ordem e mesmos nomes acessíveis de antes
  // (leitura → decisão → edição → exclusão).
  const rowActions = useCallback(
    (execution: ProductionExecution): DataTableRowAction[] => {
      const actions: DataTableRowAction[] = [
        {
          label: "Ocorrências do apontamento",
          title: "Ocorrências",
          icon: MessageSquareWarning,
          onClick: () => setOccurrencesTarget(execution),
        },
        {
          label: "Fotos do apontamento",
          title: "Fotos",
          icon: Images,
          onClick: () => setAttachmentsTarget(execution),
        },
      ];
      if (canDecideExecution(currentRole, execution)) {
        actions.push(
          {
            label: "Validar apontamento",
            title: "Validar",
            icon: Check,
            tone: "primary",
            onClick: () => setDecision({ mode: "validate", execution }),
          },
          {
            label: "Rejeitar apontamento",
            title: "Rejeitar",
            icon: X,
            tone: "destructive",
            onClick: () => setDecision({ mode: "reject", execution }),
          },
        );
      }
      if (canEditExecution(currentRole, execution)) {
        actions.push({
          label: "Editar apontamento",
          title: "Editar",
          icon: Pencil,
          onClick: () => setEditTarget(execution),
        });
      }
      if (canDelete && canDeleteExecution(currentRole, execution)) {
        actions.push({
          label: "Excluir apontamento",
          title: "Excluir",
          icon: Trash2,
          tone: "destructive",
          onClick: () => setDeleteTarget(execution),
        });
      }
      return actions;
    },
    [canDelete, currentRole],
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
        meta: { cellVariant: "primary", cellClassName: "tabular-nums" },
        cell: ({ row }) => formatPlanDate(row.original.harvestedAt),
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
        meta: { numeric: true },
        cell: ({ row }) => formatQuantity(row.original.quantity),
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
        meta: { numeric: true, cellVariant: "secondary" },
        cell: (info) => formatNumber(info.getValue()),
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
      // Só "Ocorrências" e "Fotos" (leitura, 4 roles) ⇒ o cabeçalho não sugere escrita.
      header: canWrite || canDecide ? "Ações" : "Ocorrências e fotos",
      cell: ({ row }) => <DataTableRowActions actions={rowActions(row.original)} />,
    });

    // "Ocorrências" e "Fotos" são leitura liberada às 4 roles: a coluna sempre existe.
    return [...baseColumns, actionsColumn] as ColumnDef<
      ProductionExecution,
      unknown
    >[];
  }, [canWrite, canDecide, loading, formatQuantity, rowActions]);

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
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAttachmentsTarget(execution)}
            >
              <Images />
              Fotos
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
      <div className="flex flex-col gap-section-sm">
        <BackLink href={backToPlansHref}>Voltar para planos</BackLink>
        <EmptyState
          variant="card"
          role="alert"
          headingLevel="h2"
          icon={FileQuestion}
          title="Plano não encontrado"
          hint="O plano de produção não existe ou o endereço está incorreto."
        />
      </div>
    );
  }

  // Falha na primeira carga: sem plano não há o que listar, e a tabela vazia
  // diria "nenhum apontamento" quando na verdade nada foi lido (UX-L4-01).
  const showExecutions = !(error && !plan);

  const planTitle =
    !loading && plan?.crop
      ? `${plan.crop.name} — ${plan.crop.variety}`
      : "Plano de produção";

  return (
    // Entre blocos maiores (cabeçalho → resumo → gráfico → apontamentos):
    // gap-section (24px), como no Figma 156:29.
    <div className="flex flex-col gap-section">
      {/* Figma 156:29: breadcrumb com ">" + "← Voltar para planos" + título. */}
      <PageHeader
        breadcrumb={[
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
          { label: planTitle },
        ]}
        back={{ href: backToPlansHref, label: "Voltar para planos" }}
        loading={loading}
        title={planTitle}
        description={plan ? <PlanMeta plan={plan} /> : undefined}
      />

      {/* O role="alert" do InlineAlert já anuncia: sem aria-live em volta. */}
      {error && (
        <InlineAlert
          variant="destructive"
          action={{ label: "Tentar novamente", onClick: () => refresh() }}
        >
          {error}
        </InlineAlert>
      )}

      <ComparisonSummary comparison={comparison} loading={loading} />

      {/* Mesmos dados já carregados pela tela — sem chamada extra (AC-015). */}
      {loading ? (
        <HarvestChartSkeleton />
      ) : (
        plan && <ContinuousHarvestChart plan={plan} executions={executions} />
      )}

      {showExecutions && (
        <section
          aria-labelledby="plan-executions-title"
          className="flex flex-col gap-section-sm"
        >
          <SectionHeader
            id="plan-executions-title"
            title="Apontamentos de colheita"
            description="Histórico diário do que foi colhido em campo. Somente apontamentos validados contam no realizado."
            actions={
              canWrite && plan ? (
                <Button type="button" size="lg" onClick={() => setCreateOpen(true)}>
                  <Plus aria-hidden="true" />
                  Novo apontamento
                </Button>
              ) : undefined
            }
          />

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
            emptyHint={
              canWrite && plan
                ? "Registre cada colheita com a data e a quantidade colhida."
                : "Os apontamentos deste plano aparecem aqui quando forem registrados."
            }
            emptyActionLabel={
              canWrite && plan ? "Criar primeiro apontamento" : undefined
            }
            onEmptyAction={
              canWrite && plan ? () => setCreateOpen(true) : undefined
            }
            renderMobileCard={renderMobileCard}
          />

          <DataTablePagination table={table} />
        </section>
      )}

      <ExecutionOccurrencesSheet
        execution={occurrencesTarget}
        open={occurrencesTarget !== null}
        onOpenChange={(open) => {
          if (!open) setOccurrencesTarget(null);
        }}
        canWrite={canWriteEvidence(currentRole, occurrencesTarget)}
      />

      <ExecutionAttachmentsSheet
        execution={attachmentsTarget}
        open={attachmentsTarget !== null}
        onOpenChange={(open) => {
          if (!open) setAttachmentsTarget(null);
        }}
        canWrite={canWriteEvidence(currentRole, attachmentsTarget)}
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
