"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, Sprout } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
  getFarmerSummary,
  type FarmerPlanCard,
  type FarmerSummary,
  type ProgressStatus,
} from "@/lib/analytics";
import { ApiError } from "@/lib/api";
import { listHarvests, type Harvest } from "@/lib/harvests";
import { getMyProducer } from "@/lib/producers";
import {
  formatNumber,
  formatPlanDate,
  PLAN_STATUS_LABELS,
} from "@/lib/production";

const CURRENT = "__current__";

export const PROGRESS_LABELS: Record<ProgressStatus, string> = {
  GOAL_REACHED: "Meta atingida",
  ON_TRACK: "No ritmo",
  BELOW_EXPECTED: "Abaixo do esperado",
  DELAYED: "Atrasado",
  NOT_STARTED: "Não iniciado",
};

const PROGRESS_BAR: Record<ProgressStatus, string> = {
  GOAL_REACHED: "bg-green-600",
  ON_TRACK: "bg-green-600",
  BELOW_EXPECTED: "bg-yellow-500",
  DELAYED: "bg-red-600",
  NOT_STARTED: "bg-gray-400",
};

const PROGRESS_BADGE: Record<ProgressStatus, string> = {
  GOAL_REACHED: "bg-green-100 text-green-800",
  ON_TRACK: "bg-green-100 text-green-800",
  BELOW_EXPECTED: "bg-yellow-100 text-yellow-900",
  DELAYED: "bg-red-100 text-red-800",
  NOT_STARTED: "bg-gray-100 text-gray-700",
};

type Paths = { farmerId: string; org: string; community: string } | null;

function planHref(paths: Paths, planId: string): string | null {
  if (!paths) return null;
  return `/admin/organizacoes/${paths.org}/comunidades/${paths.community}/produtores/${paths.farmerId}/planos/${planId}`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium tabular-nums">{value}</span>
    </div>
  );
}

function PlanCard({ card, href }: { card: FarmerPlanCard; href: string | null }) {
  const clamped = Math.max(0, Math.min(100, card.completionPct));
  const title = card.cropVariety
    ? `${card.cropName} · ${card.cropVariety}`
    : card.cropName;
  return (
    <Card data-testid="farmer-plan-card" data-progress={card.progressStatus}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>
          {card.locationDescription ? `${card.locationDescription} · ` : ""}
          {PLAN_STATUS_LABELS[card.status] ?? card.status}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${PROGRESS_BADGE[card.progressStatus]}`}
          >
            {PROGRESS_LABELS[card.progressStatus]}
          </span>
          <span className="text-sm font-semibold tabular-nums">
            {formatNumber(card.completionPct)}%
          </span>
        </div>
        <div
          role="progressbar"
          aria-label={`Progresso de ${title}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(clamped)}
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
        >
          <div
            data-testid="progress-fill"
            className={`h-full rounded-full ${PROGRESS_BAR[card.progressStatus]}`}
            style={{ width: `${clamped}%` }}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Área" value={`${formatNumber(card.plantedAreaHa)} ha`} />
          <Stat label="Meta" value={`${formatNumber(card.targetKg)} kg`} />
          <Stat label="Realizado" value={`${formatNumber(card.realizedKg)} kg`} />
          <Stat label="Pendente" value={`${formatNumber(card.pendingKg)} kg`} />
        </div>
        <p className="text-xs text-muted-foreground">
          Último apontamento: {formatPlanDate(card.lastExecutionDate)}
        </p>
        {href && (
          <Link
            href={href}
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Ver plano
            <span className="sr-only"> de {title}</span>
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
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar o resumo da sua safra.",
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
    <div className="flex items-center gap-2">
      <Label htmlFor="farmer-harvest" className="font-normal text-muted-foreground">
        Safra
      </Label>
      <Select
        value={harvestId}
        onValueChange={(v) => setHarvestId(v ?? CURRENT)}
      >
        <SelectTrigger id="farmer-harvest" className="min-w-44">
          <SelectValue>
            {(v) =>
              v === CURRENT || !v
                ? "Safra vigente"
                : (harvests.find((h) => h.id === v)?.label ?? "Safra vigente")
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={CURRENT}>Safra vigente</SelectItem>
          {harvests.map((h) => (
            <SelectItem key={h.id} value={h.id}>
              {h.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  let body: React.ReactNode;
  if (loading) {
    body = (
      <div
        className="flex flex-col gap-4"
        aria-busy="true"
        aria-label="Carregando painel"
      >
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
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
          <span>{error}</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => load(harvestId)}
        >
          Tentar novamente
        </Button>
      </div>
    );
  } else if (summary) {
    const plansHref = paths
      ? `/admin/organizacoes/${paths.org}/comunidades/${paths.community}/produtores/${paths.farmerId}`
      : null;
    if (summary.isEmpty) {
      body = (
        <Card className="border-dashed bg-transparent ring-0 shadow-none">
          <CardHeader className="items-center text-center">
            <Sprout className="size-6 text-muted-foreground" aria-hidden />
            <CardTitle className="text-base">
              Você ainda não tem planos de produção nesta safra
            </CardTitle>
            <CardDescription>
              Cadastre o seu primeiro plano de produção ou fale com o seu
              técnico para planejar a safra. Depois dos apontamentos validados,
              o progresso aparece aqui.
            </CardDescription>
            {plansHref && (
              <Link
                href={plansHref}
                className="mt-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Ir para os meus planos
              </Link>
            )}
          </CardHeader>
        </Card>
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
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {totals.map(([label, value]) => (
              <Card key={label}>
                <CardHeader>
                  <CardDescription>{label}</CardDescription>
                  <CardTitle className="text-2xl font-semibold tracking-tight tabular-nums">
                    {value}
                  </CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            O realizado conta apenas apontamentos validados; o pendente são
            apontamentos que aguardam validação.
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {summary.plans.map((card) => (
              <PlanCard
                key={card.planId}
                card={card}
                href={planHref(paths, card.planId)}
              />
            ))}
          </div>
        </div>
      );
    }
  } else {
    body = null;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {summary?.currentHarvest ? `Safra: ${summary.currentHarvest.label}` : ""}
        </p>
        {selector}
      </div>
      {body}
    </div>
  );
}
