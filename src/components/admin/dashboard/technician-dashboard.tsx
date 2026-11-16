"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CircleCheck,
  ClipboardList,
  Hourglass,
  LandPlot,
  MapPin,
  Sprout,
  Target,
  TrendingUp,
  TriangleAlert,
  Users,
  Wheat,
  type LucideIcon,
} from "lucide-react";
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type Row,
} from "@tanstack/react-table";

import { CommunityBarChart } from "@/components/admin/dashboard/community-bar-chart";
import {
  DashboardToolbar,
  FilterSelect,
  type FilterOption,
} from "@/components/admin/dashboard/dashboard-toolbar";
import {
  NAME_CELL,
  NUMERIC,
  TEXT_CELL,
  WRAP_HEADER,
} from "@/components/admin/dashboard/table-meta";
import { WarningCard } from "@/components/admin/dashboard/warning-card";
import { DataTable } from "@/components/data-table/data-table";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { PaginationBar } from "@/components/data-table/pagination-bar";
import { ExportMenu } from "@/components/admin/dashboard/export-menu";
import { EmptyState } from "@/components/admin/empty-state";
import { KpiCard, KpiGrid } from "@/components/admin/kpi-card";
import { SectionHeader } from "@/components/admin/section-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  exportTechnicianSummary,
  getTechnicianSummary,
  type TechnicianFarmerSummary,
  type TechnicianSummary,
  type TechnicianWarning,
} from "@/lib/analytics";
import { ApiError, apiErrorMessage } from "@/lib/api";
import { moveFocusTo } from "@/lib/focus";
import { harvestText } from "@/lib/harvest-label";
import { listCrops, type Crop } from "@/lib/crops";
import { listHarvests, type Harvest } from "@/lib/harvests";
import { formatNumber, formatPlanDate } from "@/lib/production";
import { getMyAssignedProducers } from "@/lib/technicians";
import { CARD_PAGE_SIZE, usePagedItems } from "@/lib/use-paged-items";

/** Alvo do foco quando o CTA de erro/vazio desmonta (A11Y-L5-R2-1). */
const FILTER_FOCUS_ID = "tech-harvest";
/** "Voltar para Todas" muda a Comunidade: o foco vai para esse seletor (UX-L6-05). */
const COMMUNITY_FOCUS_ID = "tech-community";
const ALL = "__all__";
const CURRENT = "__current__";

type Paths = Record<string, { org: string; community: string }>;

const LOAD_ERROR = "Não foi possível carregar o resumo da carteira.";

/** Ícone decorativo de cada indicador (o rótulo é o que comunica). */
const KPI_ICONS = {
  "Comunidades atendidas": MapPin,
  "Agricultores assistidos": Users,
  "Planos de produção": ClipboardList,
  "Área plantada": LandPlot,
  Meta: Target,
  "Realizado (validado)": Wheat,
  "Pendente de validação": Hourglass,
  Conclusão: TrendingUp,
} as const satisfies Record<string, LucideIcon>;
type KpiLabel = keyof typeof KPI_ICONS;
const KPI_LABELS = Object.keys(KPI_ICONS) as KpiLabel[];
/** Indicadores que têm a linha de dica (o skeleton reserva a altura). */
const KPI_WITH_HINT = new Set<KpiLabel>(["Planos de produção", "Pendente de validação"]);
const HIGHLIGHT_KPI = "Conclusão";

function planHref(paths: Paths, warning: TechnicianWarning): string | null {
  if (!warning.farmerId) return null;
  const p = paths[warning.farmerId];
  if (!p) return null;
  return `/admin/organizacoes/${p.org}/comunidades/${p.community}/produtores/${warning.farmerId}/planos/${warning.planId}`;
}

function sortWarnings(list: TechnicianWarning[]): TechnicianWarning[] {
  const high = list.filter((w) => w.severity === "HIGH");
  const rest = list.filter((w) => w.severity !== "HIGH");
  return [...high, ...rest];
}

/** Situação do agricultor: texto + ícone (a cor só reforça). */
function ComplianceBadge({ compliant }: { compliant: boolean }) {
  return compliant ? (
    <Badge variant="success" icon={CircleCheck}>
      Em dia
    </Badge>
  ) : (
    <Badge variant="warning" icon={TriangleAlert}>
      Pendências
    </Badge>
  );
}

const farmerColumns: ColumnDef<TechnicianFarmerSummary>[] = [
  {
    accessorKey: "farmerName",
    header: "Agricultor",
    meta: NAME_CELL,
    cell: ({ row }) => row.original.farmerName,
  },
  {
    accessorKey: "communityName",
    header: "Comunidade",
    meta: { cellClassName: TEXT_CELL },
    cell: ({ row }) => row.original.communityName ?? "—",
  },
  {
    id: "plans",
    meta: NUMERIC,
    header: "Planos (ativos)",
    cell: ({ row }) =>
      `${formatNumber(row.original.plansCount)} (${formatNumber(row.original.activePlansCount)})`,
  },
  {
    id: "area",
    meta: NUMERIC,
    header: "Área (ha)",
    cell: ({ row }) => formatNumber(row.original.plantedAreaHa),
  },
  {
    id: "target",
    meta: NUMERIC,
    header: "Meta (kg)",
    cell: ({ row }) => formatNumber(row.original.targetKg),
  },
  {
    id: "realized",
    meta: NUMERIC,
    header: "Realizado (kg)",
    cell: ({ row }) => formatNumber(row.original.realizedKg),
  },
  {
    id: "pending",
    meta: NUMERIC,
    header: "Pendente (kg)",
    cell: ({ row }) => formatNumber(row.original.pendingKg),
  },
  {
    id: "completion",
    meta: NUMERIC,
    header: "% conclusão",
    cell: ({ row }) => `${formatNumber(row.original.completionPct)}%`,
  },
  {
    id: "last",
    meta: { headerClassName: WRAP_HEADER },
    header: "Último apontamento",
    cell: ({ row }) => formatPlanDate(row.original.lastExecutionDate),
  },
  {
    id: "warnings",
    meta: NUMERIC,
    header: "Alertas",
    cell: ({ row }) => formatNumber(row.original.warningsCount),
  },
  {
    id: "compliance",
    header: "Situação",
    cell: ({ row }) => <ComplianceBadge compliant={row.original.isCompliant} />,
  },
];

function FarmerMobileCard({ farmer }: { farmer: TechnicianFarmerSummary }) {
  return (
    <Card data-testid="farmer-card">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{farmer.farmerName}</CardTitle>
          <ComplianceBadge compliant={farmer.isCompliant} />
        </div>
        <CardDescription>{farmer.communityName ?? "—"}</CardDescription>
      </CardHeader>
      <div className="grid grid-cols-2 gap-2 px-4 pb-4 text-sm">
        <span>
          Planos: {formatNumber(farmer.plansCount)} ({formatNumber(farmer.activePlansCount)} ativos)
        </span>
        <span>Área: {formatNumber(farmer.plantedAreaHa)} ha</span>
        <span>Meta: {formatNumber(farmer.targetKg)} kg</span>
        <span>Realizado: {formatNumber(farmer.realizedKg)} kg</span>
        <span>Pendente: {formatNumber(farmer.pendingKg)} kg</span>
        <span>Conclusão: {formatNumber(farmer.completionPct)}%</span>
        <span>Último: {formatPlanDate(farmer.lastExecutionDate)}</span>
        <span>Alertas: {formatNumber(farmer.warningsCount)}</span>
      </div>
    </Card>
  );
}

function FarmersTable({ farmers }: { farmers: TechnicianFarmerSummary[] }) {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: farmers,
    columns: farmerColumns,
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });
  // `contain: inline-size` impede que as 11 colunas alarguem a página: a
  // tabela rola na horizontal dentro do próprio contêiner.
  return (
    <div className="flex w-full min-w-0 flex-col gap-3 [contain:inline-size]">
      <DataTable
        label="Lista de agricultores da carteira"
        table={table}
        columns={farmerColumns}
        emptyTitle="Nenhum agricultor com plano neste recorte."
        renderMobileCard={(row: Row<TechnicianFarmerSummary>) => (
          <FarmerMobileCard farmer={row.original} />
        )}
      />
      <DataTablePagination table={table} />
    </div>
  );
}

/**
 * Visão geral do técnico (Feature 6.2): números de
 * `GET /analytics/technicians/me/summary`, sem recalcular nada no front.
 */
export function TechnicianDashboard() {
  const [summary, setSummary] = useState<TechnicianSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; status: number | null } | null>(null);
  const [harvests, setHarvests] = useState<Harvest[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [paths, setPaths] = useState<Paths>({});
  const [communityOptions, setCommunityOptions] = useState<FilterOption[]>([]);
  const [harvestId, setHarvestId] = useState(CURRENT);
  const [communityId, setCommunityId] = useState(ALL);
  const [cropId, setCropId] = useState(ALL);

  useEffect(() => {
    let alive = true;
    listHarvests()
      .then((list) => {
        if (!alive) return;
        setHarvests([...list].sort((a, b) => b.startDate.localeCompare(a.startDate)));
      })
      .catch(() => {});
    listCrops()
      .then((list) => {
        if (alive) setCrops(list);
      })
      .catch(() => {});
    getMyAssignedProducers()
      .then((list) => {
        if (!alive) return;
        const map: Paths = {};
        for (const p of list) {
          const org = p.community?.organization?.id;
          if (p.community && org) {
            map[p.id] = { org, community: p.community.id };
          }
        }
        setPaths(map);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const warnings = useMemo(
    () => sortWarnings(summary?.warnings ?? []),
    [summary],
  );
  const pagedWarnings = usePagedItems(warnings, CARD_PAGE_SIZE);
  const { reset: resetWarningsPage } = pagedWarnings;

  // Só a resposta da consulta mais recente vale.
  const requestSeq = useRef(0);

  // Safra/cultura para as quais `communityOptions` foram obtidas.
  const optionsKey = useRef<string | null>(null);

  const load = useCallback(async (h: string, c: string, k: string) => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const harvestParam = h === CURRENT ? undefined : h;
      const cropParam = k === ALL ? undefined : k;
      const key = `${h}|${k}`;
      const toOptions = (data: TechnicianSummary): FilterOption[] =>
        data.communities.map((x) => ({ value: x.communityId, label: x.communityName }));

      // Com comunidade escolhida a resposta encolhe: se a safra ou a cultura
      // mudaram, as opções vêm de uma consulta sem `communityId`.
      const optionsPromise =
        c !== ALL && optionsKey.current !== key
          ? getTechnicianSummary({ harvestId: harvestParam, cropId: cropParam })
              .then(toOptions)
              .catch(() => null)
          : null;
      const mainPromise = getTechnicianSummary({
        harvestId: harvestParam,
        communityId: c === ALL ? undefined : c,
        cropId: cropParam,
      });
      mainPromise.catch(() => {});

      if (optionsPromise) {
        const options = await optionsPromise;
        if (seq !== requestSeq.current) return;
        if (options) {
          setCommunityOptions(options);
          optionsKey.current = key;
          if (!options.some((o) => o.value === c)) {
            // A comunidade não existe neste recorte: volta para "Todas"
            // (troca de filtro: os cartões voltam para a página 1).
            setCommunityId(ALL);
            resetWarningsPage();
            return;
          }
        }
      }

      const data = await mainPromise;
      if (seq !== requestSeq.current) return;
      setSummary(data);
      if (c === ALL) {
        setCommunityOptions(toOptions(data));
        optionsKey.current = key;
      }
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setSummary(null);
      setError({
        message:
          apiErrorMessage(err, LOAD_ERROR),
        status: err instanceof ApiError ? err.status : null,
      });
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [resetWarningsPage]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(harvestId, communityId, cropId);
  }, [load, harvestId, communityId, cropId]);

  // Trocar qualquer filtro volta os cartões de alerta para a página 1.
  const changeHarvest = (next: string) => {
    setHarvestId(next);
    resetWarningsPage();
  };
  const changeCommunity = (next: string) => {
    setCommunityId(next);
    resetWarningsPage();
  };
  const changeCrop = (next: string) => {
    setCropId(next);
    resetWarningsPage();
  };

  const hasFilters = harvestId !== CURRENT || communityId !== ALL || cropId !== ALL;
  const clearFilters = () => {
    setHarvestId(CURRENT);
    setCommunityId(ALL);
    setCropId(ALL);
    resetWarningsPage();
  };
  // O botão some com a nova carga: o foco vai para o seletor de safra.
  const clearFiltersAndFocus = () => {
    moveFocusTo(FILTER_FOCUS_ID);
    clearFilters();
  };

  const filters = (
    <>
      <FilterSelect
        id={FILTER_FOCUS_ID}
        label="Safra"
        value={harvestId}
        onChange={changeHarvest}
        options={[
          { value: CURRENT, label: "Safra vigente" },
          ...harvests.map((h) => ({ value: h.id, label: h.label })),
        ]}
      />
      <FilterSelect
        id={COMMUNITY_FOCUS_ID}
        label="Comunidade"
        value={communityId}
        onChange={changeCommunity}
        options={[{ value: ALL, label: "Todas" }, ...communityOptions]}
      />
      <FilterSelect
        id="tech-crop"
        label="Cultura"
        value={cropId}
        onChange={changeCrop}
        options={[
          { value: ALL, label: "Todas" },
          ...crops.map((c) => ({ value: c.id, label: c.name })),
        ]}
      />
      <ExportMenu
        disabled={loading || error !== null}
        onExport={(format) =>
          exportTechnicianSummary(format, {
            harvestId: harvestId === CURRENT ? undefined : harvestId,
            communityId: communityId === ALL ? undefined : communityId,
            cropId: cropId === ALL ? undefined : cropId,
          })
        }
      />
    </>
  );

  let body: React.ReactNode = null;
  if (loading) {
    body = (
      <div
        className="flex flex-col gap-8"
        role="region"
        aria-busy="true"
        aria-label="Carregando painel"
      >
        <KpiGrid>
          {KPI_LABELS.map((label) => (
            <KpiCard
              key={label}
              label={label}
              value={null}
              reserveHint={KPI_WITH_HINT.has(label)}
              icon={KPI_ICONS[label]}
              highlight={label === HIGHLIGHT_KPI}
              loading
            />
          ))}
        </KpiGrid>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-7 w-40" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Skeleton className="h-56 rounded-xl" />
            <Skeleton className="h-56 rounded-xl" />
            <Skeleton className="h-56 rounded-xl" />
          </div>
        </div>
      </div>
    );
  } else if (error) {
    body = (
      <InlineAlert
        actions={[
          ...(error.status === 403 && communityId !== ALL
            ? [
                {
                  label: "Voltar para Todas",
                  onClick: () => {
                    moveFocusTo(COMMUNITY_FOCUS_ID);
                    changeCommunity(ALL);
                  },
                },
              ]
            : []),
          {
            label: "Tentar novamente",
            onClick: () => {
              moveFocusTo(FILTER_FOCUS_ID);
              load(harvestId, communityId, cropId);
            },
          },
        ]}
      >
        {error.message}
      </InlineAlert>
    );
  } else if (summary) {
    if (summary.isEmpty) {
      body = (
        <EmptyState
          variant="dashed"
          icon={Sprout}
          title="Nenhum plano na carteira para este recorte"
          hint={
            hasFilters
              ? "Quando os agricultores assistidos tiverem planos de produção, os indicadores e alertas aparecem aqui. Tente outro recorte ou limpe os filtros."
              : "Quando os agricultores assistidos tiverem planos de produção, os indicadores e alertas aparecem aqui."
          }
          action={
            hasFilters ? { label: "Limpar filtros", onClick: clearFiltersAndFocus } : undefined
          }
        />
      );
    } else {
      const totals: [KpiLabel, string, string?][] = [
        ["Comunidades atendidas", formatNumber(summary.totalAssistedCommunitiesCount)],
        ["Agricultores assistidos", formatNumber(summary.totalAssistedFarmersCount)],
        [
          "Planos de produção",
          formatNumber(summary.totalPlansCount),
          `${formatNumber(summary.activePlansCount)} ativos`,
        ],
        ["Área plantada", `${formatNumber(summary.totalPlantedAreaHa)} ha`],
        ["Meta", `${formatNumber(summary.totalTargetKg)} kg`],
        ["Realizado (validado)", `${formatNumber(summary.totalRealizedKg)} kg`],
        [
          "Pendente de validação",
          `${formatNumber(summary.totalPendingKg)} kg`,
          `${formatNumber(summary.pendingExecutionsCount)} apontamentos pendentes`,
        ],
        ["Conclusão", `${formatNumber(summary.overallCompletionPct)}%`],
      ];
      body = (
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <KpiGrid>
              {totals.map(([label, value, hint]) => (
                <KpiCard
                  key={label}
                  label={label}
                  value={value}
                  hint={hint}
                  icon={KPI_ICONS[label]}
                  highlight={label === HIGHLIGHT_KPI}
                />
              ))}
            </KpiGrid>
            <p className="text-sm text-muted-foreground">
              O realizado conta apenas apontamentos validados; o pendente são
              apontamentos que aguardam validação.
            </p>
          </div>

          <section className="flex min-w-0 flex-col gap-4" aria-labelledby="tech-alerts">
            <SectionHeader
              id="tech-alerts"
              title={`Alertas (${formatNumber(summary.totalWarningsCount)})`}
            />
            {warnings.length === 0 ? (
              // Sem `role`: o painel carregado tem uma única região de status (a paginação).
              <div className="flex items-center gap-3 rounded-xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
                <CircleCheck aria-hidden="true" className="size-4 shrink-0" />
                <p>Nenhum alerta na carteira</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {pagedWarnings.pageItems.map((w) => (
                    <WarningCard key={w.planId} warning={w} href={planHref(paths, w)} />
                  ))}
                </div>
                {pagedWarnings.showPagination && (
                  <PaginationBar
                    pageIndex={pagedWarnings.pageIndex}
                    pageCount={pagedWarnings.pageCount}
                    total={pagedWarnings.total}
                    pageSize={CARD_PAGE_SIZE}
                    onPageChange={pagedWarnings.setPageIndex}
                    label="Paginação dos alertas"
                  />
                )}
              </>
            )}
          </section>

          {summary.communities.length > 0 && (
            <section className="flex min-w-0 flex-col gap-4" aria-labelledby="tech-communities">
              <SectionHeader id="tech-communities" title="Por comunidade" />
              <Card className="p-6">
                <CommunityBarChart communities={summary.communities} />
              </Card>
            </section>
          )}

          <section className="flex min-w-0 flex-col gap-4" aria-labelledby="tech-farmers">
            <SectionHeader id="tech-farmers" title="Agricultores" />
            <FarmersTable farmers={summary.farmers} />
          </section>
        </div>
      );
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <DashboardToolbar
        loading={loading && !summary}
        title="Minha carteira"
        description={
          summary?.currentHarvest ? harvestText(summary.currentHarvest.label) : undefined
        }
      >{filters}</DashboardToolbar>
      {body}
    </div>
  );
}
