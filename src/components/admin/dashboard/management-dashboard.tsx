"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type Row,
  type Table as ReactTableInstance,
} from "@tanstack/react-table";
import {
  Building2,
  ClipboardList,
  LandPlot,
  MapPin,
  Sprout,
  Target,
  TrendingUp,
  Users,
  Wheat,
  type LucideIcon,
} from "lucide-react";

import { CommunityTargetChart } from "@/components/admin/dashboard/community-target-chart";
import { CropShareChart } from "@/components/admin/dashboard/crop-share-chart";
import {
  DashboardToolbar,
  FilterSelect,
  type FilterOption,
} from "@/components/admin/dashboard/dashboard-toolbar";
import {
  NAME_CELL,
  NUMERIC,
  WRAP_HEADER,
} from "@/components/admin/dashboard/table-meta";
import { DataTable } from "@/components/data-table/data-table";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { ExportMenu } from "@/components/admin/dashboard/export-menu";
import { EmptyState } from "@/components/admin/empty-state";
import { KpiCard, KpiGrid } from "@/components/admin/kpi-card";
import { SectionHeader } from "@/components/admin/section-header";
import { Card } from "@/components/ui/card";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  exportGlobalSummary,
  exportManagerSummary,
  getGlobalSummary,
  getManagerSummary,
  type ManagementCropRankingItem,
  type ManagementCommunityPerformance,
  type ManagementSummary,
  type ManagementOrganizationSummary,
} from "@/lib/analytics";
import { ApiError, userFacingErrorHint } from "@/lib/api";
import { listCommunities } from "@/lib/communities";
import { listHarvests, type Harvest } from "@/lib/harvests";
import { listOrganizations, type Organization } from "@/lib/organizations";
import { formatNumber, formatPlanDate } from "@/lib/production";

const ALL = "__all__";
const CURRENT = "__current__";
const LOAD_ERROR = "Não foi possível carregar o painel de gestão.";

type Option = FilterOption;

const pct = (value: number) => `${formatNumber(value)}%`;

/** Ícone decorativo de cada indicador (o rótulo é o que comunica). */
const KPI_ICONS: Record<string, LucideIcon> = {
  "Organizações": Building2,
  "Volume previsto": Target,
  "Volume colhido (validado)": Wheat,
  "Taxa de conversão": TrendingUp,
  "Comunidades ativas": MapPin,
  "Agricultores": Users,
  "Planos de produção": ClipboardList,
  "Área plantada": LandPlot,
};
const HIGHLIGHT_KPI = "Taxa de conversão";

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-4" aria-labelledby={id}>
      <SectionHeader id={id} title={title} />
      {children}
    </section>
  );
}

function TableBox({ children }: { children: React.ReactNode }) {
  // `contain: inline-size`: a tabela rola dentro do contêiner, sem alargar a página.
  return <div className="w-full min-w-0 [contain:inline-size]">{children}</div>;
}

const PAGE_SIZE = 10;

/** Tabela paginada no front (os endpoints devolvem a lista inteira). */
function usePagedTable<T>(data: T[], columns: ColumnDef<T>[]) {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });
  // eslint-disable-next-line react-hooks/incompatible-library
  return useReactTable({
    data,
    columns,
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });
}

function MobileCard({
  title,
  items,
}: {
  title: string;
  items: [string, string][];
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-4">
      <p className="font-medium">{title}</p>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
        {items.map(([label, value]) => (
          <div key={label} className="flex flex-col">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function PagedTable<T>({
  testId,
  table,
  columns,
  renderMobileCard,
}: {
  testId: string;
  table: ReactTableInstance<T>;
  columns: ColumnDef<T>[];
  renderMobileCard: (row: Row<T>) => React.ReactNode;
}) {
  return (
    <TableBox>
      <div className="flex flex-col gap-3">
        <div data-testid={testId}>
          <DataTable table={table} columns={columns} renderMobileCard={renderMobileCard} />
        </div>
        <DataTablePagination table={table} />
      </div>
    </TableBox>
  );
}

const cropName = (c: ManagementCropRankingItem) =>
  `${c.cropName}${c.cropVariety ? ` (${c.cropVariety})` : ""}`;

const cropColumns: ColumnDef<ManagementCropRankingItem>[] = [
  { id: "rank", meta: NUMERIC, header: "#", cell: ({ row }) => row.original.rankPosition },
  {
    id: "crop",
    meta: NAME_CELL,
    header: "Cultura",
    cell: ({ row }) => <span className="font-medium">{cropName(row.original)}</span>,
  },
  { id: "plans", meta: NUMERIC, header: "Planos", cell: ({ row }) => formatNumber(row.original.plansCount) },
  { id: "area", meta: NUMERIC, header: "Área (ha)", cell: ({ row }) => formatNumber(row.original.plantedAreaHa) },
  { id: "target", meta: NUMERIC, header: "Meta (kg)", cell: ({ row }) => formatNumber(row.original.targetKg) },
  { id: "realized", meta: NUMERIC, header: "Colhido (kg)", cell: ({ row }) => formatNumber(row.original.realizedKg) },
  { id: "conversion", meta: NUMERIC, header: "Conversão", cell: ({ row }) => pct(row.original.conversionRatePct) },
  { id: "share", meta: NUMERIC, header: "Participação", cell: ({ row }) => pct(row.original.productionSharePct) },
];

function CropRankingTable({ summary }: { summary: ManagementSummary }) {
  const data = useMemo(
    () => [...summary.cropRanking].sort((a, b) => a.rankPosition - b.rankPosition),
    [summary.cropRanking],
  );
  const table = usePagedTable(data, cropColumns);
  return (
    <PagedTable
      testId="crop-ranking"
      table={table}
      columns={cropColumns}
      renderMobileCard={(row) => {
        const c = row.original;
        return (
          <MobileCard
            title={`${c.rankPosition}. ${cropName(c)}`}
            items={[
              ["Planos", formatNumber(c.plansCount)],
              ["Área (ha)", formatNumber(c.plantedAreaHa)],
              ["Meta (kg)", formatNumber(c.targetKg)],
              ["Colhido (kg)", formatNumber(c.realizedKg)],
              ["Conversão", pct(c.conversionRatePct)],
              ["Participação", pct(c.productionSharePct)],
            ]}
          />
        );
      }}
    />
  );
}

function CommunitiesTable({ summary }: { summary: ManagementSummary }) {
  const global = summary.scope === "GLOBAL";
  const columns = useMemo<ColumnDef<ManagementCommunityPerformance>[]>(
    () => [
      {
        id: "community",
        meta: NAME_CELL,
        header: "Comunidade",
        cell: ({ row }) => <span className="font-medium">{row.original.communityName}</span>,
      },
      ...(global
        ? [
            {
              id: "organization",
              meta: NAME_CELL,
              header: "Organização",
              cell: ({ row }: { row: Row<ManagementCommunityPerformance> }) =>
                row.original.organizationName ?? "—",
            },
          ]
        : []),
      { id: "farmers", meta: NUMERIC, header: "Agricultores ativos", cell: ({ row }) => formatNumber(row.original.activeFarmersCount) },
      { id: "compliance", meta: NUMERIC, header: "Em dia", cell: ({ row }) => pct(row.original.complianceRatePct) },
      { id: "plans", meta: NUMERIC, header: "Planos", cell: ({ row }) => formatNumber(row.original.plansCount) },
      { id: "area", meta: NUMERIC, header: "Área (ha)", cell: ({ row }) => formatNumber(row.original.plantedAreaHa) },
      { id: "target", meta: NUMERIC, header: "Meta (kg)", cell: ({ row }) => formatNumber(row.original.targetKg) },
      { id: "realized", meta: NUMERIC, header: "Colhido (kg)", cell: ({ row }) => formatNumber(row.original.realizedKg) },
      { id: "conversion", meta: NUMERIC, header: "Conversão", cell: ({ row }) => pct(row.original.conversionRatePct) },
      { id: "last", meta: { headerClassName: WRAP_HEADER }, header: "Último apontamento", cell: ({ row }) => formatPlanDate(row.original.lastExecutionDate) },
    ],
    [global],
  );
  const table = usePagedTable(summary.communities, columns);
  return (
    <PagedTable
      testId="communities-table"
      table={table}
      columns={columns}
      renderMobileCard={(row) => {
        const c = row.original;
        return (
          <MobileCard
            title={c.communityName}
            items={[
              ...(global ? ([["Organização", c.organizationName ?? "—"]] as [string, string][]) : []),
              ["Agricultores ativos", formatNumber(c.activeFarmersCount)],
              ["Em dia", pct(c.complianceRatePct)],
              ["Planos", formatNumber(c.plansCount)],
              ["Área (ha)", formatNumber(c.plantedAreaHa)],
              ["Meta (kg)", formatNumber(c.targetKg)],
              ["Colhido (kg)", formatNumber(c.realizedKg)],
              ["Conversão", pct(c.conversionRatePct)],
              ["Último apontamento", formatPlanDate(c.lastExecutionDate)],
            ]}
          />
        );
      }}
    />
  );
}

const organizationColumns: ColumnDef<ManagementOrganizationSummary>[] = [
  {
    id: "organization",
    meta: NAME_CELL,
    header: "Organização",
    cell: ({ row }) => <span className="font-medium">{row.original.organizationName}</span>,
  },
  { id: "communities", meta: NUMERIC, header: "Comunidades", cell: ({ row }) => formatNumber(row.original.communitiesCount) },
  { id: "farmers", meta: NUMERIC, header: "Agricultores", cell: ({ row }) => formatNumber(row.original.activeFarmersCount) },
  { id: "compliance", meta: NUMERIC, header: "Em dia", cell: ({ row }) => pct(row.original.complianceRatePct) },
  { id: "plans", meta: NUMERIC, header: "Planos", cell: ({ row }) => formatNumber(row.original.plansCount) },
  { id: "area", meta: NUMERIC, header: "Área (ha)", cell: ({ row }) => formatNumber(row.original.plantedAreaHa) },
  { id: "target", meta: NUMERIC, header: "Meta (kg)", cell: ({ row }) => formatNumber(row.original.targetKg) },
  { id: "realized", meta: NUMERIC, header: "Colhido (kg)", cell: ({ row }) => formatNumber(row.original.realizedKg) },
  { id: "conversion", meta: NUMERIC, header: "Conversão", cell: ({ row }) => pct(row.original.conversionRatePct) },
];

function OrganizationsTable({ summary }: { summary: ManagementSummary }) {
  const table = usePagedTable(summary.organizations, organizationColumns);
  return (
    <PagedTable
      testId="organizations-table"
      table={table}
      columns={organizationColumns}
      renderMobileCard={(row) => {
        const o = row.original;
        return (
          <MobileCard
            title={o.organizationName}
            items={[
              ["Comunidades", formatNumber(o.communitiesCount)],
              ["Agricultores", formatNumber(o.activeFarmersCount)],
              ["Em dia", pct(o.complianceRatePct)],
              ["Planos", formatNumber(o.plansCount)],
              ["Área (ha)", formatNumber(o.plantedAreaHa)],
              ["Meta (kg)", formatNumber(o.targetKg)],
              ["Colhido (kg)", formatNumber(o.realizedKg)],
              ["Conversão", pct(o.conversionRatePct)],
            ]}
          />
        );
      }}
    />
  );
}

/**
 * Visão geral macro-gerencial (Feature 6.3). `MANAGER` consulta a sua
 * organização (`/analytics/organizations/me/summary`); `ADMIN`, o global
 * (`/analytics/global/summary`) com filtro de organização. Todos os números
 * vêm do back; nada é recalculado aqui.
 */
export function ManagementDashboard({ role }: { role: "MANAGER" | "ADMIN" }) {
  const isAdmin = role === "ADMIN";
  const [summary, setSummary] = useState<ManagementSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; status: number | null } | null>(null);
  const [harvests, setHarvests] = useState<Harvest[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [communityOptions, setCommunityOptions] = useState<Option[]>([]);
  const [managerOrgId, setManagerOrgId] = useState<string | null>(null);
  const [harvestId, setHarvestId] = useState(CURRENT);
  const [organizationId, setOrganizationId] = useState(ALL);
  const [communityId, setCommunityId] = useState(ALL);

  useEffect(() => {
    let alive = true;
    listHarvests()
      .then((list) => {
        if (alive) setHarvests([...list].sort((a, b) => b.startDate.localeCompare(a.startDate)));
      })
      .catch(() => {});
    if (isAdmin) {
      listOrganizations()
        .then((list) => {
          if (alive) setOrganizations(list);
        })
        .catch(() => {});
    }
    return () => {
      alive = false;
    };
  }, [isAdmin]);

  // Comunidades: do admin, as da organização escolhida; do gestor, as da sua
  // (id vem da primeira resposta de sucesso do resumo; até lá o seletor fica
  // desabilitado em "Todas" e as opções carregam assim que a organização é conhecida).
  const communitiesOrgId = isAdmin
    ? organizationId === ALL
      ? null
      : organizationId
    : managerOrgId;
  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCommunityOptions([]);
    if (!communitiesOrgId) return;
    listCommunities(communitiesOrgId)
      .then((list) => {
        if (alive) setCommunityOptions(list.map((c) => ({ value: c.id, label: c.name })));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [communitiesOrgId]);

  // Só a resposta da consulta mais recente vale.
  const requestSeq = useRef(0);

  const load = useCallback(
    async (h: string, o: string, c: string) => {
      const seq = ++requestSeq.current;
      setLoading(true);
      setError(null);
      const params = {
        harvestId: h === CURRENT ? undefined : h,
        communityId: c === ALL ? undefined : c,
      };
      try {
        const data = isAdmin
          ? await getGlobalSummary({ ...params, organizationId: o === ALL ? undefined : o })
          : await getManagerSummary(params);
        if (seq !== requestSeq.current) return;
        setSummary(data);
        if (!isAdmin && data.organizationId) setManagerOrgId(data.organizationId);
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
    },
    [isAdmin],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(harvestId, organizationId, communityId);
  }, [load, harvestId, organizationId, communityId]);

  const changeOrganization = (value: string) => {
    setOrganizationId(value);
    setCommunityId(ALL);
  };

  const hasFilters =
    harvestId !== CURRENT || organizationId !== ALL || communityId !== ALL;
  const clearFilters = () => {
    setHarvestId(CURRENT);
    setOrganizationId(ALL);
    setCommunityId(ALL);
  };

  const filters = (
    <>
      <FilterSelect
        id="mgmt-harvest"
        label="Safra"
        value={harvestId}
        onChange={setHarvestId}
        options={[
          { value: CURRENT, label: "Safra vigente" },
          ...harvests.map((h) => ({ value: h.id, label: h.label })),
        ]}
      />
      {isAdmin && (
        <FilterSelect
          id="mgmt-organization"
          label="Organização"
          value={organizationId}
          onChange={changeOrganization}
          options={[
            { value: ALL, label: "Todas" },
            ...organizations.map((o) => ({ value: o.id, label: o.name })),
          ]}
        />
      )}
      <FilterSelect
        id="mgmt-community"
        label="Comunidade"
        value={communityId}
        onChange={setCommunityId}
        disabled={!communitiesOrgId}
        options={[{ value: ALL, label: "Todas" }, ...communityOptions]}
      />
      <ExportMenu
        disabled={loading || error !== null}
        onExport={(format) => {
          const params = {
            harvestId: harvestId === CURRENT ? undefined : harvestId,
            communityId: communityId === ALL ? undefined : communityId,
          };
          return isAdmin
            ? exportGlobalSummary(format, {
                ...params,
                organizationId: organizationId === ALL ? undefined : organizationId,
              })
            : exportManagerSummary(format, params);
        }}
      />
    </>
  );

  // Rótulos dos indicadores na ordem em que aparecem (o skeleton usa os mesmos).
  const showOrgCount = isAdmin && organizationId === ALL;
  const kpiLabels = [
    ...(showOrgCount ? ["Organizações"] : []),
    "Volume previsto",
    "Volume colhido (validado)",
    "Taxa de conversão",
    "Comunidades ativas",
    "Agricultores",
    "Planos de produção",
    "Área plantada",
  ];

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
          {kpiLabels.map((label) => (
            <KpiCard
              key={label}
              label={label}
              value={null}
              hint={label === "Agricultores" ? "em dia" : undefined}
              icon={KPI_ICONS[label]}
              highlight={label === HIGHLIGHT_KPI}
              loading
            />
          ))}
        </KpiGrid>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  } else if (error) {
    body = (
      <InlineAlert
        actions={[
          ...(hasFilters ? [{ label: "Limpar filtros", onClick: clearFilters }] : []),
          {
            label: "Tentar novamente",
            onClick: () => load(harvestId, organizationId, communityId),
          },
        ]}
      >
        {error.message}
      </InlineAlert>
    );
  } else if (summary) {
    // O back devolve `isEmpty: false` mesmo sem planos na safra: sem planos também é vazio.
    if (summary.isEmpty || summary.totalPlansCount === 0) {
      body = (
        <EmptyState
          variant="dashed"
          icon={Sprout}
          title="Nenhum plano de produção para este recorte"
          hint={
            hasFilters
              ? "Quando houver planos de produção com apontamentos validados, os indicadores aparecem aqui. Tente outro recorte ou limpe os filtros."
              : "Quando houver planos de produção com apontamentos validados, os indicadores aparecem aqui."
          }
          action={
            hasFilters ? { label: "Limpar filtros", onClick: clearFilters } : undefined
          }
        />
      );
    } else {
      const showOrgs = summary.scope === "GLOBAL" && organizationId === ALL;
      const totals: [string, string, string?][] = [
        ...(showOrgs
          ? ([["Organizações", formatNumber(summary.totalOrganizationsCount)]] as [string, string][])
          : []),
        ["Volume previsto", `${formatNumber(summary.totalTargetKg)} kg`],
        ["Volume colhido (validado)", `${formatNumber(summary.totalRealizedKg)} kg`],
        ["Taxa de conversão", pct(summary.overallConversionRatePct)],
        ["Comunidades ativas", formatNumber(summary.totalCommunitiesCount)],
        [
          "Agricultores",
          formatNumber(summary.totalFarmersCount),
          `${formatNumber(summary.compliantFarmersCount)} em dia (${pct(summary.complianceRatePct)})`,
        ],
        ["Planos de produção", formatNumber(summary.totalPlansCount)],
        ["Área plantada", `${formatNumber(summary.totalPlantedAreaHa)} ha`],
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
              Os números são atualizados periodicamente: um apontamento validado
              pode levar alguns minutos para aparecer aqui.
            </p>
          </div>

          {summary.cropRanking.length > 0 && (
            <>
              <Section id="mgmt-ranking" title="Ranking de culturas">
                <CropRankingTable summary={summary} />
              </Section>
              <Section id="mgmt-share" title="Participação por cultura">
                <Card className="p-6">
                  <CropShareChart ranking={summary.cropRanking} />
                </Card>
              </Section>
            </>
          )}

          {summary.communities.length > 0 && (
            <Section id="mgmt-communities" title="Comparativo entre comunidades">
              <Card className="p-6">
                <CommunityTargetChart communities={summary.communities} />
              </Card>
              <CommunitiesTable summary={summary} />
            </Section>
          )}

          {summary.scope === "GLOBAL" && summary.organizations.length > 0 && (
            <Section id="mgmt-organizations" title="Comparativo entre organizações">
              <OrganizationsTable summary={summary} />
            </Section>
          )}
        </div>
      );
    }
  }

  // No escopo global com organização filtrada o back devolve o nome dela.
  const title = summary
    ? (summary.organizationName ??
      (summary.scope === "GLOBAL" ? "Todas as organizações" : ""))
    : "";

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <DashboardToolbar
        loading={loading && !summary}
        title={title ? <span data-testid="mgmt-scope-title">{title}</span> : undefined}
        description={
          summary?.currentHarvest ? `Safra: ${summary.currentHarvest.label}` : undefined
        }
      >
        {filters}
      </DashboardToolbar>
      {body}
    </div>
  );
}
