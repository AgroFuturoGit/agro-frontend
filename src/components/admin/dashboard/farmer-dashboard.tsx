"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CircleAlert,
  ClipboardList,
  Clock,
  Fence,
  Hourglass,
  LandPlot,
  Sprout,
  Target,
  TrendingUp,
  TriangleAlert,
  Wheat,
  type LucideIcon,
} from "lucide-react";

import {
  DashboardToolbar,
  FilterSelect,
} from "@/components/admin/dashboard/dashboard-toolbar";
import { ExportMenu } from "@/components/admin/dashboard/export-menu";
import { EmptyState } from "@/components/admin/empty-state";
import { KpiCard, KpiGrid } from "@/components/admin/kpi-card";
import { SectionHeader } from "@/components/admin/section-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  exportFarmerSummary,
  getFarmerSummary,
  type FarmerPlanCard,
  type FarmerSummary,
  type ProgressStatus,
} from "@/lib/analytics";
import { ApiError, userFacingErrorHint } from "@/lib/api";
import { listHarvests, type Harvest } from "@/lib/harvests";
import { getMyProducer } from "@/lib/producers";
import {
  formatNumber,
  formatPlanDate,
  PLAN_STATUS_LABELS,
} from "@/lib/production";
import {
  PROGRESS_STATUS_BADGE_VARIANT,
  PROGRESS_STATUS_VARIANT,
} from "@/lib/status-variants";

const CURRENT = "__current__";
const LOAD_ERROR = "Não foi possível carregar o resumo da sua safra.";

export const PROGRESS_LABELS: Record<ProgressStatus, string> = {
  GOAL_REACHED: "Meta atingida",
  ON_TRACK: "No ritmo",
  BELOW_EXPECTED: "Abaixo do esperado",
  DELAYED: "Atrasado",
  NOT_STARTED: "Não iniciado",
};

// Ícone por status (a cor não é o único sinal). `undefined` = padrão do
// Badge (CircleCheck no `success`).
const PROGRESS_ICON: Record<ProgressStatus, LucideIcon | undefined> = {
  GOAL_REACHED: undefined,
  ON_TRACK: undefined,
  BELOW_EXPECTED: TriangleAlert,
  DELAYED: CircleAlert,
  NOT_STARTED: Clock,
};

/** Ícone decorativo de cada indicador (o rótulo é o que comunica). */
const KPI_ICONS: Record<string, LucideIcon> = {
  "Planos de produção": ClipboardList,
  "Talhões ativos": Fence,
  "Área plantada": LandPlot,
  Meta: Target,
  "Realizado (validado)": Wheat,
  "Pendente de validação": Hourglass,
  Conclusão: TrendingUp,
};
const KPI_LABELS = Object.keys(KPI_ICONS);
const HIGHLIGHT_KPI = "Conclusão";

type Paths = { farmerId: string; org: string; community: string } | null;

function planHref(paths: Paths, planId: string): string | null {
  if (!paths) return null;
  return `/admin/organizacoes/${paths.org}/comunidades/${paths.community}/produtores/${paths.farmerId}/planos/${planId}`;
}

/** Par rótulo/valor dentro do cartão do plano (não é um card de KPI). */
function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-base font-medium text-foreground tabular-nums">{value}</dd>
    </div>
  );
}

function PlanCard({ card, href }: { card: FarmerPlanCard; href: string | null }) {
  const clamped = Math.max(0, Math.min(100, card.completionPct));
  const title = card.cropVariety
    ? `${card.cropName} · ${card.cropVariety}`
    : card.cropName;
  return (
    <Card
      data-testid="farmer-plan-card"
      data-progress={card.progressStatus}
      className="gap-4 py-6"
    >
      <CardHeader className="px-6">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          {card.locationDescription ? `${card.locationDescription} · ` : ""}
          {PLAN_STATUS_LABELS[card.status] ?? card.status}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4 px-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <Badge
              variant={PROGRESS_STATUS_BADGE_VARIANT[card.progressStatus]}
              icon={PROGRESS_ICON[card.progressStatus]}
            >
              {PROGRESS_LABELS[card.progressStatus]}
            </Badge>
            <span className="text-base font-semibold text-foreground tabular-nums">
              {formatNumber(card.completionPct)}%
            </span>
          </div>
          <Progress
            value={clamped}
            variant={PROGRESS_STATUS_VARIANT[card.progressStatus]}
            aria-label={`Progresso de ${title}`}
            indicatorProps={{ "data-testid": "progress-fill" }}
          />
        </div>
        <dl className="grid grid-cols-2 gap-3">
          <MetaItem label="Área" value={`${formatNumber(card.plantedAreaHa)} ha`} />
          <MetaItem label="Meta" value={`${formatNumber(card.targetKg)} kg`} />
          <MetaItem label="Realizado" value={`${formatNumber(card.realizedKg)} kg`} />
          <MetaItem label="Pendente" value={`${formatNumber(card.pendingKg)} kg`} />
        </dl>
        <p className="text-sm text-muted-foreground">
          Último apontamento: {formatPlanDate(card.lastExecutionDate)}
        </p>
        {href && (
          <Link
            href={href}
            className="mt-auto inline-flex w-fit items-center gap-1 rounded-sm text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            Ver plano
            <span className="sr-only"> de {title}</span>
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Visão geral do agricultor (Feature 6.1): números de
 * `GET /analytics/farmers/me/summary`, sem recalcular nada no front.
 */
export function FarmerDashboard() {
  const [summary, setSummary] = useState<FarmerSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [harvests, setHarvests] = useState<Harvest[]>([]);
  const [harvestId, setHarvestId] = useState<string>(CURRENT);
  const [paths, setPaths] = useState<Paths>(null);

  useEffect(() => {
    let alive = true;
    listHarvests()
      .then((list) => {
        if (!alive) return;
        setHarvests(
          [...list].sort((a, b) => b.startDate.localeCompare(a.startDate)),
        );
      })
      .catch(() => {});
    getMyProducer()
      .then((p) => {
        if (!alive) return;
        const org = p.community?.organization?.id;
        if (p.community && org) {
          setPaths({ farmerId: p.id, org, community: p.community.id });
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Só a resposta da consulta mais recente vale: ao trocar de safra rápido,
  // uma resposta atrasada da safra anterior não pode sobrescrever a nova.
  const requestSeq = useRef(0);

  const load = useCallback(async (selected: string) => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const data = await getFarmerSummary(
        selected === CURRENT ? undefined : selected,
      );
      if (seq !== requestSeq.current) return;
      setSummary(data);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setSummary(null);
      setError(
        (err instanceof ApiError ? userFacingErrorHint(err.message) : undefined) ??
          LOAD_ERROR,
      );
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(harvestId);
  }, [load, harvestId]);

  const selector = (
    <FilterSelect
      id="farmer-harvest"
      label="Safra"
      value={harvestId}
      onChange={setHarvestId}
      options={[
        { value: CURRENT, label: "Safra vigente" },
        ...harvests.map((h) => ({ value: h.id, label: h.label })),
      ]}
    />
  );

  let body: React.ReactNode;
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
              icon={KPI_ICONS[label]}
              highlight={label === HIGHLIGHT_KPI}
              loading
            />
          ))}
        </KpiGrid>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-7 w-48" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Skeleton className="h-72 rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
          </div>
        </div>
      </div>
    );
  } else if (error) {
    body = (
      <InlineAlert
        action={{ label: "Tentar novamente", onClick: () => load(harvestId) }}
      >
        {error}
      </InlineAlert>
    );
  } else if (summary) {
    const plansHref = paths
      ? `/admin/organizacoes/${paths.org}/comunidades/${paths.community}/produtores/${paths.farmerId}`
      : null;
    if (summary.isEmpty) {
      body = (
        <EmptyState
          variant="dashed"
          icon={Sprout}
          title="Você ainda não tem planos de produção nesta safra"
          hint="Cadastre o seu primeiro plano de produção ou fale com o seu técnico para planejar a safra. Depois dos apontamentos validados, o progresso aparece aqui."
          action={
            plansHref
              ? { label: "Ir para os meus planos", href: plansHref, variant: "default" }
              : undefined
          }
        />
      );
    } else {
      const totals: [string, string][] = [
        ["Planos de produção", formatNumber(summary.totalPlansCount)],
        ["Talhões ativos", formatNumber(summary.activePlotsCount)],
        ["Área plantada", `${formatNumber(summary.totalPlantedAreaHa)} ha`],
        ["Meta", `${formatNumber(summary.totalTargetKg)} kg`],
        ["Realizado (validado)", `${formatNumber(summary.totalRealizedKg)} kg`],
        ["Pendente de validação", `${formatNumber(summary.totalPendingKg)} kg`],
        ["Conclusão", `${formatNumber(summary.overallCompletionPct)}%`],
      ];
      body = (
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <KpiGrid>
              {totals.map(([label, value]) => (
                <KpiCard
                  key={label}
                  label={label}
                  value={value}
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
          <section className="flex min-w-0 flex-col gap-4" aria-labelledby="farmer-plans">
            <SectionHeader id="farmer-plans" title="Meus planos de produção" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {summary.plans.map((card) => (
                <PlanCard
                  key={card.planId}
                  card={card}
                  href={planHref(paths, card.planId)}
                />
              ))}
            </div>
          </section>
        </div>
      );
    }
  } else {
    body = null;
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
      <DashboardToolbar heading={heading}>
        {selector}
        <ExportMenu
          disabled={loading || error !== null}
          onExport={(format) =>
            exportFarmerSummary(
              format,
              harvestId === CURRENT ? undefined : harvestId,
            )
          }
        />
      </DashboardToolbar>
      {body}
    </div>
  );
}
