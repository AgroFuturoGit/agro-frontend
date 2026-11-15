"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CircleAlert,
  CircleCheck,
  ClipboardList,
  Hourglass,
  LandPlot,
  MapPin,
  Sprout,
  Target,
  TrendingUp,
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
import { WarningCard } from "@/components/admin/dashboard/warning-card";
import { DataTable } from "@/components/data-table/data-table";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { ExportMenu } from "@/components/admin/dashboard/export-menu";
import { EmptyState } from "@/components/admin/empty-state";
import { KpiCard, KpiGrid } from "@/components/admin/kpi-card";
import { SectionHeader } from "@/components/admin/section-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { ApiError, userFacingErrorHint } from "@/lib/api";
import { listCrops, type Crop } from "@/lib/crops";
import { listHarvests, type Harvest } from "@/lib/harvests";
import { formatNumber, formatPlanDate } from "@/lib/production";
import { getMyAssignedProducers } from "@/lib/technicians";

const ALL = "__all__";
const CURRENT = "__current__";

type Paths = Record<string, { org: string; community: string }>;

type Option = FilterOption;

const LOAD_ERROR = "Não foi possível carregar o resumo da carteira.";

/** Ícone decorativo de cada indicador (o rótulo é o que comunica). */
const KPI_ICONS: Record<string, LucideIcon> = {
  "Comunidades atendidas": MapPin,
  "Agricultores assistidos": Users,
  "Planos de produção": ClipboardList,
  "Área plantada": LandPlot,
  Meta: Target,
  "Realizado (validado)": Wheat,
  "Pendente de validação": Hourglass,
  Conclusão: TrendingUp,
};
const KPI_LABELS = Object.keys(KPI_ICONS);
/** Indicadores que têm a linha de dica (o skeleton reserva a altura). */
const KPI_WITH_HINT = new Set(["Planos de produção", "Pendente de validação"]);
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
    <Badge variant="warning" icon={CircleAlert}>
      Pendências
    </Badge>
  );
}

// 11 colunas precisam caber em 1440px sem rolagem: cabeçalhos longos
// quebram linha e nomes quebram dentro de uma largura mínima.
const WRAP_HEADER = "whitespace-normal leading-tight";
const TEXT_CELL = "min-w-28 whitespace-normal";
const NUMERIC = { numeric: true, headerClassName: WRAP_HEADER } as const;

const farmerColumns: ColumnDef<TechnicianFarmerSummary>[] = [
  {
    accessorKey: "farmerName",
    header: "Agricultor",
    meta: { cellVariant: "primary", cellClassName: TEXT_CELL },
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
  const [communityOptions, setCommunityOptions] = useState<Option[]>([]);
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
      const toOptions = (data: TechnicianSummary): Option[] =>
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
            // A comunidade não existe neste recorte: volta para "Todas".
            setCommunityId(ALL);
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
          (err instanceof ApiError ? userFacingErrorHint(err.message) : undefined) ??
          LOAD_ERROR,
        status: err instanceof ApiError ? err.status : null,
      });
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(harvestId, communityId, cropId);
  }, [load, harvestId, communityId, cropId]);

  const hasFilters = harvestId !== CURRENT || communityId !== ALL || cropId !== ALL;
  const clearFilters = () => {
    setHarvestId(CURRENT);
    setCommunityId(ALL);
    setCropId(ALL);
  };

  const warnings = useMemo(
    () => sortWarnings(summary?.warnings ?? []),
    [summary],
  );

  const filters = (
    <>
      <FilterSelect
        id="tech-harvest"
        label="Safra"
        value={harvestId}
        onChange={setHarvestId}
        options={[
          { value: CURRENT, label: "Safra vigente" },
          ...harvests.map((h) => ({ value: h.id, label: h.label })),
        ]}
      />
      <FilterSelect
        id="tech-community"
        label="Comunidade"
        value={communityId}
        onChange={setCommunityId}
        options={[{ value: ALL, label: "Todas" }, ...communityOptions]}
      />
      <FilterSelect
        id="tech-crop"
        label="Cultura"
        value={cropId}
        onChange={setCropId}
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
        aria-busy="true"
        aria-label="Carregando painel"
      >
        <KpiGrid>
          {KPI_LABELS.map((label) => (
            <KpiCard
              key={label}
              label={label}
              value={null}
              hint={KPI_WITH_HINT.has(label) ? "…" : undefined}
              icon={KPI_ICONS[label]}
              highlight={label === HIGHLIGHT_KPI}
              loading
            />
          ))}
        </KpiGrid>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    );
  } else if (error) {
    body = (
      <InlineAlert>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>{error.message}</span>
          <div className="flex flex-wrap gap-2">
            {error.status === 403 && communityId !== ALL && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-foreground"
                onClick={() => setCommunityId(ALL)}
              >
                Voltar para Todas
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-foreground"
              onClick={() => load(harvestId, communityId, cropId)}
            >
              Tentar novamente
            </Button>
          </div>
        </div>
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
            hasFilters ? { label: "Limpar filtros", onClick: clearFilters } : undefined
          }
        />
      );
    } else {
      const totals: [string, string, string?][] = [
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
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {warnings.map((w) => (
                  <WarningCard key={w.planId} warning={w} href={planHref(paths, w)} />
                ))}
              </div>
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

  const heading =
    loading && !summary ? (
      <Skeleton aria-hidden="true" className="h-6 w-40" />
    ) : summary?.currentHarvest ? (
      <p className="text-base font-medium text-foreground">
        {`Safra: ${summary.currentHarvest.label}`}
      </p>
    ) : null;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <DashboardToolbar heading={heading}>{filters}</DashboardToolbar>
      {body}
    </div>
  );
}
