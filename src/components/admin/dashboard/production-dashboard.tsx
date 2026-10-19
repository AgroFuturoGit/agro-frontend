"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Sprout, Users } from "lucide-react";

import { ComparisonSummary } from "@/components/admin/production/comparison-summary";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError } from "@/lib/api";
import { readUserFromStorage, type Role } from "@/lib/auth";
import {
  formatNumber,
  getProductionDashboard,
  type ProductionDashboard as Dashboard,
} from "@/lib/production";

/**
 * Painel da Visão geral: números de `GET /production/dashboard`. O recorte
 * (agricultor, técnico, gestor, admin) é aplicado pelo back; o front só decide
 * se mostra a quebra por comunidade (todos menos FARMER).
 */
export function ProductionDashboard() {
  const [role, setRole] = useState<Role | null>(null);
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRole(readUserFromStorage()?.role ?? null);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getProductionDashboard());
    } catch (err) {
      setData(null);
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar o painel de produção.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (loading) {
    return (
      <div
        className="flex flex-col gap-4"
        aria-busy="true"
        aria-label="Carregando painel"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="flex items-start justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
      >
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => load()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (!data) return null;

  if (data.planCount === 0) {
    return (
      <Card className="border-dashed bg-transparent ring-0 shadow-none">
        <CardHeader className="items-center text-center">
          <CardTitle className="text-base">
            Nenhum plano de produção no seu recorte
          </CardTitle>
          <CardDescription>
            Quando houver planos de produção com apontamentos validados, a meta
            e o realizado aparecem aqui.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Falha fechado: sem role conhecida não mostra a quebra por comunidade.
  const showCommunities = role !== null && role !== "FARMER";

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center justify-between">
              <span>Agricultores</span>
              <Users className="size-4" aria-hidden />
            </CardDescription>
            <CardTitle className="text-3xl font-semibold tracking-tight tabular-nums">
              {formatNumber(data.farmerCount)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center justify-between">
              <span>Planos de produção</span>
              <Sprout className="size-4" aria-hidden />
            </CardDescription>
            <CardTitle className="text-3xl font-semibold tracking-tight tabular-nums">
              {formatNumber(data.planCount)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <ComparisonSummary
        comparison={{
          productionPlanId: "",
          expectedYield: data.expectedYield,
          totalActualYield: data.actualYield,
          difference: data.difference,
          percentageRealized: data.percentageRealized,
        }}
      />
      <p className="text-sm text-muted-foreground">
        Previsto é a meta de colheita dos planos; o realizado considera apenas
        apontamentos validados.
      </p>

      {showCommunities && (
        <div className="flex flex-col gap-3">
          <h3 className="text-lg font-semibold tracking-tight">
            Por comunidade
          </h3>
          <Card className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Comunidade</TableHead>
                  <TableHead className="text-right">Agricultores</TableHead>
                  <TableHead className="text-right">Planos</TableHead>
                  <TableHead className="text-right">Meta (kg)</TableHead>
                  <TableHead className="text-right">Realizado (kg)</TableHead>
                  <TableHead className="text-right">% realizado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.communities.map((row) => (
                  <TableRow key={row.communityId ?? "sem-comunidade"}>
                    <TableCell className="font-medium">
                      {row.communityName}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(row.farmerCount)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(row.planCount)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(row.expectedYield)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(row.actualYield)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(row.percentageRealized)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}
    </div>
  );
}
