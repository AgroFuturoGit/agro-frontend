"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
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

import { EmptyValue } from "@/components/admin/empty-value";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import {
  DataTableRowActions,
  type DataTableRowAction,
} from "@/components/data-table/data-table-row-actions";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { FamilyCompositionSection } from "@/components/admin/producers/family-composition-section";
import { FinancingSection } from "@/components/admin/producers/financing-section";
import { withFocusMove } from "@/lib/focus";
import { userFacingErrorHint, apiDomainMessage, apiErrorMessage } from "@/lib/api";
import { readUserFromStorage, type Role } from "@/lib/auth";
import { getCommunity } from "@/lib/communities";
import { buildPlanBreadcrumb } from "@/lib/plan-breadcrumb";
import { getMyProducer, listProducers, producerDisplayName } from "@/lib/producers";
import {
  PLAN_STATUS_LABELS,
  formatNumber,
  formatPlanDate,
  listProductionPlans,
  planCropLabel,
  planDisplayName,
  type ProductionPlan,
} from "@/lib/production";
import { PLAN_STATUS_VARIANT } from "@/lib/status-variants";
import { getMyAssignedProducers } from "@/lib/technicians";

import { DeletePlanDialog } from "./delete-plan-dialog";
import { PlanFormDrawer } from "./plan-form-drawer";

type Props = {
  orgId: string;
  communityId: string;
  producerId: string;
};

/** Organização e comunidade ficam ausentes quando o papel não as exibe (TECHNICIAN). */
type BreadcrumbNames = {
  organizationName?: string;
  communityName?: string;
  producerLabel: string;
};

/** `id` do título: alvo do foco do "Tentar novamente" da guarda (A11Y-L6-5). */
const PLANS_TITLE_ID = "producer-plans-title";

function PlanStatusBadge({ plan }: { plan: ProductionPlan }) {
  if (!plan.status) return <EmptyValue />;
  return (
    <Badge variant={PLAN_STATUS_VARIANT[plan.status]}>
      {PLAN_STATUS_LABELS[plan.status]}
    </Badge>
  );
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
  return [planCropLabel(plan), plan.harvest?.label].some((value) =>
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

  // Layout effect: a role é lida antes da primeira pintura, então o
  // breadcrumb já sai com os níveis do papel, sem o frame com a role nula
  // (e sem o salto do espaço reservado para o FARMER). Até a leitura, a
  // role é nula e nenhuma afordância de escrita renderiza (RN4).
  useLayoutEffect(() => {
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
        producerLabel: producerDisplayName(producer),
      });
      setGuardPassed(true);
    } catch (err) {
      setGuardError(
        apiErrorMessage(err, "Não foi possível verificar o acesso a este agricultor."),
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

    if (currentRole === "TECHNICIAN") {
      // `GET /communities/{id}` e `GET /farmers` dão 403 para o técnico: o
      // nome sai da lista dos agricultores atendidos por ele. O breadcrumb do
      // técnico não mostra organização nem comunidade.
      getMyAssignedProducers()
        .then((producers) =>
          producerDisplayName(producers.find((item) => item.id === producerId)),
        )
        .catch(() => "Agricultor")
        .then((producerLabel) => {
          if (active) setNames({ producerLabel });
        });
      return () => {
        active = false;
      };
    }

    Promise.all([getCommunity(communityId), listProducers(communityId)])
      .then(([community, producers]) => {
        if (!active) return;
        const producer = producers.find((item) => item.id === producerId);
        setNames({
          organizationName: community.organization.name,
          communityName: community.name,
          producerLabel:
            producerDisplayName(producer),
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
      setError(apiDomainMessage(err) ?? "");
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

  // Mesmos nomes acessíveis na tabela e no card mobile: prefixo fixo
  // ("Editar plano", "Excluir plano") + cultura e safra do registro.
  const rowActions = useCallback(
    (plan: ProductionPlan): DataTableRowAction[] => {
      const name = planDisplayName(plan);
      const actions: DataTableRowAction[] = [
        {
          label: `Editar plano ${name}`,
          icon: Pencil,
          onClick: () => setEditTarget(plan),
        },
      ];
      if (canDelete) {
        actions.push({
          label: `Excluir plano ${name}`,
          icon: Trash2,
          tone: "destructive",
          onClick: () => setDeleteTarget(plan),
        });
      }
      return actions;
    },
    [canDelete],
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
      columnHelper.accessor((plan) => planCropLabel(plan), {
        id: "crop",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Cultivo" disabled={loading} />
        ),
        meta: { cellVariant: "primary" },
        cell: ({ row }) => (
          <Link href={planHref(row.original)} className="hover:underline">
            {planCropLabel(row.original) || <EmptyValue />}
          </Link>
        ),
      }),
      columnHelper.accessor((plan) => plan.harvest?.label ?? "", {
        id: "harvest",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Safra" disabled={loading} />
        ),
        meta: { cellVariant: "secondary" },
        cell: (info) => info.getValue() || <EmptyValue />,
        filterFn: (row, columnId, filterValue) =>
          !filterValue || row.getValue(columnId) === filterValue,
      }),
      columnHelper.accessor("plantedArea", {
        header: ({ column }) => (
          <div className="flex justify-end">
            <DataTableColumnHeader column={column} title="Área (ha)" disabled={loading} />
          </div>
        ),
        meta: { numeric: true, cellVariant: "primary" },
        cell: (info) => formatNumber(info.getValue()),
      }),
      columnHelper.accessor("expectedYield", {
        header: ({ column }) => (
          <div className="flex justify-end">
            <DataTableColumnHeader column={column} title="Meta (kg)" disabled={loading} />
          </div>
        ),
        meta: { numeric: true, cellVariant: "primary" },
        // Plano legado sem produtividade => meta 0 => "—".
        cell: (info) =>
          info.getValue() > 0 ? formatNumber(info.getValue()) : <EmptyValue />,
      }),
      columnHelper.accessor((plan) => plan.status ?? "", {
        id: "status",
        header: "Status",
        enableSorting: false,
        cell: ({ row }) => <PlanStatusBadge plan={row.original} />,
      }),
      // ISO `YYYY-MM-DD`: a comparação lexicográfica já ordena por data.
      columnHelper.accessor((plan) => plan.plannedPlantingDate ?? "", {
        id: "plannedPlantingDate",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Plantio" disabled={loading} />
        ),
        meta: { cellVariant: "secondary", cellClassName: "tabular-nums" },
        cell: ({ row }) =>
          row.original.plannedPlantingDate ? (
            formatPlanDate(row.original.plannedPlantingDate)
          ) : (
            <EmptyValue />
          ),
      }),
    ];

    const actionsColumn = columnHelper.display({
      id: "actions",
      header: "Ações",
      cell: ({ row }) => <DataTableRowActions actions={rowActions(row.original)} />,
    });

    return (canWrite ? [...baseColumns, actionsColumn] : baseColumns) as ColumnDef<
      ProductionPlan,
      unknown
    >[];
  }, [canWrite, loading, planHref, rowActions]);

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
              className="font-medium text-foreground hover:underline"
            >
              {planCropLabel(plan) || <EmptyValue />}
            </Link>
            <p className="mt-1 text-sm text-muted-foreground tabular-nums">
              {plan.harvest?.label || <EmptyValue />} · Plantio{" "}
              {formatPlanDate(plan.plannedPlantingDate)}
            </p>
            <p className="mt-1 text-sm tabular-nums">
              {formatNumber(plan.plantedArea)} ha ·{" "}
              {plan.expectedYield > 0
                ? `${formatNumber(plan.expectedYield)} kg de meta`
                : "Sem meta"}
            </p>
            {plan.status ? (
              <div className="mt-2">
                <PlanStatusBadge plan={plan} />
              </div>
            ) : null}
          </div>
          {canWrite && (
            <DataTableRowActions
              align="end"
              className="shrink-0"
              actions={rowActions(plan)}
            />
          )}
        </div>
      </Card>
    );
  }

  if (redirecting) {
    // AGRICULTOR na URL de outro: nada desse cadastro aparece enquanto o
    // redirecionamento acontece (só a estrutura da página).
    return (
      <div className="flex flex-col gap-section-sm">
        {/* Texto de espera visível (sem role=status permanente), como em
            organizations-page. */}
        <PageHeader
          title="Planos de produção"
          description="Abrindo os seus planos de produção…"
        />
        <div aria-busy="true">
          <Skeleton aria-hidden="true" className="h-40 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (guardError) {
    // Mesma estrutura (div > div > PageHeader) da tela principal: com
    // `titleId`, o <h2> continua montado depois do "Tentar novamente" e
    // recebe o foco quando o alerta desmonta (A11Y-L6-5).
    return (
      <div className="flex flex-col gap-section">
        <div className="flex flex-col gap-section-sm">
          {/* Mesma posição do espaço reservado ao breadcrumb na tela
              principal, para o PageHeader não remontar. */}
          {currentRole === null ? (
            <div aria-hidden="true" className="h-5" />
          ) : null}
          <PageHeader title="Planos de produção" titleId={PLANS_TITLE_ID} />
          <InlineAlert
            variant="destructive"
            action={{
              label: "Tentar novamente",
              onClick: withFocusMove(PLANS_TITLE_ID, () => runGuard()),
            }}
          >
            {guardError}
          </InlineAlert>
        </div>
      </div>
    );
  }

  return (
    // Entre blocos da página (planos, composição familiar, financiamentos):
    // gap-section (24px); dentro do bloco dos planos: gap-section-sm (16px).
    <div className="flex flex-col gap-section">
      <div className="flex flex-col gap-section-sm">
        {/* Figma 129:569: breadcrumb acima do título, com os níveis que o
            papel pode abrir. Antes de a role ser lida, só a altura dele fica
            reservada (sem níveis que depois sumiriam); o gap do bloco é o
            mesmo do PageHeader entre breadcrumb e título. */}
        {currentRole === null ? (
          <div aria-hidden="true" className="h-5" />
        ) : null}
        <PageHeader
          breadcrumb={buildPlanBreadcrumb({
            role: currentRole,
            page: "plans",
            ids: { orgId, communityId, producerId },
            names: names && {
              org: names.organizationName,
              community: names.communityName,
              producer: names.producerLabel,
            },
          })}
          title="Planos de produção"
          titleId={PLANS_TITLE_ID}
          description={`Planos de ${names?.producerLabel ?? "produção"}.`}
          // Até os nomes chegarem, skeleton no lugar do título e da descrição
          // (nada de "Planos de produção." provisório).
          loading={names === null}
          actions={
            canWrite && guardPassed ? (
              <Button type="button" size="lg" onClick={() => setCreateOpen(true)}>
                <Plus aria-hidden="true" />
                Novo plano
              </Button>
            ) : undefined
          }
        />

        <DataTableToolbar
          table={table}
          searchPlaceholder="Buscar por cultivo ou safra…"
          filters={[{ columnId: "harvest", label: "Safra", options: harvestOptions }]}
        />

        <DataTable
          label="Lista de planos de produção"
          table={table}
          columns={columns}
          isLoading={loading}
          hasError={error !== null}
          onRetry={refresh}
          errorHint={userFacingErrorHint(error)}
          hasActiveFilters={
            Boolean(table.getState().globalFilter) ||
            table.getState().columnFilters.length > 0
          }
          onClearFilters={() => {
            table.setGlobalFilter("");
            table.resetColumnFilters();
          }}
          emptyTitle="Nenhum plano de produção cadastrado ainda."
          emptyHint={
            canWrite
              ? "Crie um plano escolhendo a cultura, a safra, a área plantada e as datas previstas."
              : "Os planos deste agricultor aparecem aqui quando forem cadastrados."
          }
          emptyActionLabel={canWrite ? "Criar primeiro plano" : undefined}
          onEmptyAction={canWrite ? () => setCreateOpen(true) : undefined}
          renderMobileCard={renderMobileCard}
        />

        <DataTablePagination table={table} />
      </div>

      {/* Dados sociais do agricultor: carregam e falham de forma independente
          dos planos. Escrita: ADMIN, TECHNICIAN e FARMER (o back decide o
          resto); MANAGER e role desconhecida só leem. */}
      {guardPassed && (
        <>
          <FamilyCompositionSection farmerId={producerId} canWrite={canWrite} />
          <FinancingSection farmerId={producerId} canWrite={canWrite} />
        </>
      )}

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
