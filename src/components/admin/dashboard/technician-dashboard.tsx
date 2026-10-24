"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Sprout } from "lucide-react";
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type Row,
} from "@tanstack/react-table";

import { CommunityBarChart } from "@/components/admin/dashboard/community-bar-chart";
import { WarningCard } from "@/components/admin/dashboard/warning-card";
import { DataTable } from "@/components/data-table/data-table";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  getTechnicianSummary,
  type TechnicianFarmerSummary,
  type TechnicianSummary,
  type TechnicianWarning,
} from "@/lib/analytics";
import { ApiError } from "@/lib/api";
import { listCrops, type Crop } from "@/lib/crops";
import { listHarvests, type Harvest } from "@/lib/harvests";
import { formatNumber, formatPlanDate } from "@/lib/production";
import { getMyAssignedProducers } from "@/lib/technicians";

const ALL = "__all__";
const CURRENT = "__current__";

type Paths = Record<string, { org: string; community: string }>;

type Option = { value: string; label: string };

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

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
}) {
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={id} className="font-normal text-muted-foreground">
        {label}
      </Label>
      <Select value={value} onValueChange={(v) => onChange(v ?? options[0].value)}>
        <SelectTrigger id={id} className="min-w-40">
          <SelectValue>
            {(v) =>
              options.find((o) => o.value === v)?.label ?? options[0].label
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ComplianceBadge({ compliant }: { compliant: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        compliant ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-900"
      }`}
    >
      {compliant ? (
        <CheckCircle2 className="size-3" aria-hidden />
      ) : (
        <AlertCircle className="size-3" aria-hidden />
      )}
      {compliant ? "Em dia" : "Pendências"}
    </span>
  );
}

const farmerColumns: ColumnDef<TechnicianFarmerSummary>[] = [
  {
    accessorKey: "farmerName",
    header: "Agricultor",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.farmerName}</span>
    ),
  },
  {
    accessorKey: "communityName",
    header: "Comunidade",
    cell: ({ row }) => row.original.communityName ?? "—",
  },
  {
    id: "plans",
    header: "Planos (ativos)",
    cell: ({ row }) =>
      `${formatNumber(row.original.plansCount)} (${formatNumber(row.original.activePlansCount)})`,
  },
  {
    id: "area",
    header: "Área (ha)",
    cell: ({ row }) => formatNumber(row.original.plantedAreaHa),
  },
  {
    id: "target",
    header: "Meta (kg)",
    cell: ({ row }) => formatNumber(row.original.targetKg),
  },
  {
    id: "realized",
    header: "Realizado (kg)",
    cell: ({ row }) => formatNumber(row.original.realizedKg),
  },
  {
    id: "pending",
    header: "Pendente (kg)",
    cell: ({ row }) => formatNumber(row.original.pendingKg),
  },
  {
    id: "completion",
    header: "% conclusão",
    cell: ({ row }) => `${formatNumber(row.original.completionPct)}%`,
  },
  {
    id: "last",
    header: "Último apontamento",
    cell: ({ row }) => formatPlanDate(row.original.lastExecutionDate),
  },
  {
    id: "warnings",
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
    <div className="w-full min-w-0 [contain:inline-size]">
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
          err instanceof ApiError
            ? err.message
            : "Não foi possível carregar o resumo da carteira.",
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
    <div className="flex flex-wrap items-center gap-3">
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
    </div>
  );

  let body: React.ReactNode = null;
  if (loading) {
    body = (
      <div
        className="flex flex-col gap-4"
        aria-busy="true"
        aria-label="Carregando painel"
      >
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  } else if (error) {
    body = (
      <div
        role="alert"
        className="flex items-start justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
      >
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error.message}</span>
        </div>
        <div className="flex gap-2">
          {error.status === 403 && communityId !== ALL && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCommunityId(ALL)}
            >
              Voltar para Todas
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => load(harvestId, communityId, cropId)}
          >
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  } else if (summary) {
    if (summary.isEmpty) {
      body = (
        <Card className="border-dashed bg-transparent ring-0 shadow-none">
          <CardHeader className="items-center text-center">
            <Sprout className="size-6 text-muted-foreground" aria-hidden />
            <CardTitle className="text-base">
              Nenhum plano na carteira para este recorte
            </CardTitle>
            <CardDescription>
              Quando os agricultores assistidos tiverem planos de produção, os
              indicadores e alertas aparecem aqui.
            </CardDescription>
            {hasFilters && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={clearFilters}
              >
                Limpar filtros
              </Button>
            )}
          </CardHeader>
        </Card>
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
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {totals.map(([label, value, hint]) => (
              <Card
                key={label}
                className={label === "Conclusão" ? "border-primary/40 bg-primary/5" : undefined}
              >
                <CardHeader>
                  <CardDescription>{label}</CardDescription>
                  <CardTitle className="text-2xl font-semibold tracking-tight tabular-nums">
                    {value}
                  </CardTitle>
                  {hint && <CardDescription>{hint}</CardDescription>}
                </CardHeader>
              </Card>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            O realizado conta apenas apontamentos validados; o pendente são
            apontamentos que aguardam validação.
          </p>

          <section className="flex flex-col gap-3" aria-labelledby="tech-alerts">
            <h3 id="tech-alerts" className="text-lg font-semibold tracking-tight">
              Alertas ({formatNumber(summary.totalWarningsCount)})
            </h3>
            {warnings.length === 0 ? (
              <p className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
                Nenhum alerta na carteira
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {warnings.map((w) => (
                  <WarningCard key={w.planId} warning={w} href={planHref(paths, w)} />
                ))}
              </div>
            )}
          </section>

          {summary.communities.length > 0 && (
            <section className="flex flex-col gap-3" aria-labelledby="tech-communities">
              <h3 id="tech-communities" className="text-lg font-semibold tracking-tight">
                Por comunidade
              </h3>
              <Card className="p-4">
                <CommunityBarChart communities={summary.communities} />
              </Card>
            </section>
          )}

          <section className="flex flex-col gap-3" aria-labelledby="tech-farmers">
            <h3 id="tech-farmers" className="text-lg font-semibold tracking-tight">
              Agricultores
            </h3>
            <FarmersTable farmers={summary.farmers} />
          </section>
        </div>
      );
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {summary?.currentHarvest ? `Safra: ${summary.currentHarvest.label}` : ""}
        </p>
        {filters}
      </div>
      {body}
    </div>
  );
}
