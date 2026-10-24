"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Sprout } from "lucide-react";

import { CommunityTargetChart } from "@/components/admin/dashboard/community-target-chart";
import { CropShareChart } from "@/components/admin/dashboard/crop-share-chart";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getGlobalSummary,
  getManagerSummary,
  type ManagementSummary,
} from "@/lib/analytics";
import { ApiError } from "@/lib/api";
import { listCommunities } from "@/lib/communities";
import { listHarvests, type Harvest } from "@/lib/harvests";
import { listOrganizations, type Organization } from "@/lib/organizations";
import { formatNumber, formatPlanDate } from "@/lib/production";

const ALL = "__all__";
const CURRENT = "__current__";

type Option = { value: string; label: string };

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={id} className="font-normal text-muted-foreground">
        {label}
      </Label>
      <Select
        value={value}
        disabled={disabled}
        onValueChange={(v) => onChange(v ?? options[0].value)}
      >
        <SelectTrigger id={id} className="min-w-40">
          <SelectValue>
            {(v) => options.find((o) => o.value === v)?.label ?? options[0].label}
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

const pct = (value: number) => `${formatNumber(value)}%`;

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
    <section className="flex flex-col gap-3" aria-labelledby={id}>
      <h3 id={id} className="text-lg font-semibold tracking-tight">
        {title}
      </h3>
      {children}
    </section>
  );
}

function TableBox({ children }: { children: React.ReactNode }) {
  // `contain: inline-size`: a tabela rola dentro do contêiner, sem alargar a página.
  return <div className="w-full min-w-0 [contain:inline-size]">{children}</div>;
}

function CropRankingTable({ summary }: { summary: ManagementSummary }) {
  return (
    <TableBox>
      <Table data-testid="crop-ranking">
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>Cultura</TableHead>
            <TableHead>Planos</TableHead>
            <TableHead>Área (ha)</TableHead>
            <TableHead>Meta (kg)</TableHead>
            <TableHead>Colhido (kg)</TableHead>
            <TableHead>Conversão</TableHead>
            <TableHead>Participação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...summary.cropRanking]
            .sort((a, b) => a.rankPosition - b.rankPosition)
            .map((c, i) => (
              <TableRow key={`${c.cropId ?? c.cropName}-${c.cropVariety ?? ""}-${i}`}>
                <TableCell>{c.rankPosition}</TableCell>
                <TableCell className="font-medium">
                  {c.cropName}
                  {c.cropVariety ? ` (${c.cropVariety})` : ""}
                </TableCell>
                <TableCell>{formatNumber(c.plansCount)}</TableCell>
                <TableCell>{formatNumber(c.plantedAreaHa)}</TableCell>
                <TableCell>{formatNumber(c.targetKg)}</TableCell>
                <TableCell>{formatNumber(c.realizedKg)}</TableCell>
                <TableCell>{pct(c.conversionRatePct)}</TableCell>
                <TableCell>{pct(c.productionSharePct)}</TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </TableBox>
  );
}

function CommunitiesTable({ summary }: { summary: ManagementSummary }) {
  const global = summary.scope === "GLOBAL";
  return (
    <TableBox>
      <Table data-testid="communities-table">
        <TableHeader>
          <TableRow>
            <TableHead>Comunidade</TableHead>
            {global && <TableHead>Organização</TableHead>}
            <TableHead>Agricultores ativos</TableHead>
            <TableHead>Em dia</TableHead>
            <TableHead>Planos</TableHead>
            <TableHead>Área (ha)</TableHead>
            <TableHead>Meta (kg)</TableHead>
            <TableHead>Colhido (kg)</TableHead>
            <TableHead>Conversão</TableHead>
            <TableHead>Último apontamento</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {summary.communities.map((c) => (
            <TableRow key={c.communityId}>
              <TableCell className="font-medium">{c.communityName}</TableCell>
              {global && <TableCell>{c.organizationName ?? "—"}</TableCell>}
              <TableCell>{formatNumber(c.activeFarmersCount)}</TableCell>
              <TableCell>{pct(c.complianceRatePct)}</TableCell>
              <TableCell>{formatNumber(c.plansCount)}</TableCell>
              <TableCell>{formatNumber(c.plantedAreaHa)}</TableCell>
              <TableCell>{formatNumber(c.targetKg)}</TableCell>
              <TableCell>{formatNumber(c.realizedKg)}</TableCell>
              <TableCell>{pct(c.conversionRatePct)}</TableCell>
              <TableCell>{formatPlanDate(c.lastExecutionDate)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableBox>
  );
}

function OrganizationsTable({ summary }: { summary: ManagementSummary }) {
  return (
    <TableBox>
      <Table data-testid="organizations-table">
        <TableHeader>
          <TableRow>
            <TableHead>Organização</TableHead>
            <TableHead>Comunidades</TableHead>
            <TableHead>Agricultores</TableHead>
            <TableHead>Em dia</TableHead>
            <TableHead>Planos</TableHead>
            <TableHead>Área (ha)</TableHead>
            <TableHead>Meta (kg)</TableHead>
            <TableHead>Colhido (kg)</TableHead>
            <TableHead>Conversão</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {summary.organizations.map((o) => (
            <TableRow key={o.organizationId}>
              <TableCell className="font-medium">{o.organizationName}</TableCell>
              <TableCell>{formatNumber(o.communitiesCount)}</TableCell>
              <TableCell>{formatNumber(o.activeFarmersCount)}</TableCell>
              <TableCell>{pct(o.complianceRatePct)}</TableCell>
              <TableCell>{formatNumber(o.plansCount)}</TableCell>
              <TableCell>{formatNumber(o.plantedAreaHa)}</TableCell>
              <TableCell>{formatNumber(o.targetKg)}</TableCell>
              <TableCell>{formatNumber(o.realizedKg)}</TableCell>
              <TableCell>{pct(o.conversionRatePct)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableBox>
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
            err instanceof ApiError
              ? err.message
              : "Não foi possível carregar o painel de gestão.",
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
    <div className="flex flex-wrap items-center gap-3">
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
    </div>
  );

  let body: React.ReactNode = null;
  if (loading) {
    body = (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Carregando painel">
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
          {hasFilters && (
            <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
              Limpar filtros
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => load(harvestId, organizationId, communityId)}
          >
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  } else if (summary) {
    // O back devolve `isEmpty: false` mesmo sem planos na safra: sem planos também é vazio.
    if (summary.isEmpty || summary.totalPlansCount === 0) {
      body = (
        <Card className="border-dashed bg-transparent ring-0 shadow-none">
          <CardHeader className="items-center text-center">
            <Sprout className="size-6 text-muted-foreground" aria-hidden />
            <CardTitle className="text-base">
              Nenhum plano de produção para este recorte
            </CardTitle>
            <CardDescription>
              Quando houver planos de produção com apontamentos validados, os
              indicadores aparecem aqui.
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
      const showOrgCount = summary.scope === "GLOBAL" && organizationId === ALL;
      const totals: [string, string, string?][] = [
        ...(showOrgCount
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
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {totals.map(([label, value, hint]) => (
              <Card
                key={label}
                className={label === "Taxa de conversão" ? "border-primary/40 bg-primary/5" : undefined}
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

          {summary.cropRanking.length > 0 && (
            <>
              <Section id="mgmt-ranking" title="Ranking de culturas">
                <CropRankingTable summary={summary} />
              </Section>
              <Section id="mgmt-share" title="Participação por cultura">
                <Card className="p-4">
                  <CropShareChart ranking={summary.cropRanking} />
                </Card>
              </Section>
            </>
          )}

          {summary.communities.length > 0 && (
            <Section id="mgmt-communities" title="Comparativo entre comunidades">
              <Card className="p-4">
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
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          {title && (
            <p className="text-base font-semibold" data-testid="mgmt-scope-title">
              {title}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            {summary?.currentHarvest ? `Safra: ${summary.currentHarvest.label}` : ""}
          </p>
        </div>
        {filters}
      </div>
      {body}
      <p className="text-xs text-muted-foreground">
        Os números são atualizados periodicamente: um apontamento validado pode
        levar alguns minutos para aparecer aqui.
      </p>
    </div>
  );
}
