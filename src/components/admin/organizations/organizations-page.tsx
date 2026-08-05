"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { formatCnpj } from "@/lib/cnpj";
import {
  listOrganizations,
  ORGANIZATION_TYPE_LABELS,
  type Organization,
} from "@/lib/organizations";

const COLUMN_COUNT = 3;

export function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // TODO (Task 04-02): estado de diálogo de criação/edição de Organização
  // e ação "Criar Manager" por linha.

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listOrganizations();
      setOrganizations(data);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar as organizações.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const sortedOrganizations = useMemo(
    () =>
      [...organizations].sort((a, b) => a.name.localeCompare(b.name)),
    [organizations],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Organizações
          </h2>
          <p className="text-sm text-muted-foreground">
            Cooperativas e associações cadastradas na plataforma.
          </p>
        </div>
        {/* TODO (Task 04-02): botão "Nova Organização" */}
      </div>

      {error && (
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
            onClick={() => refresh()}
          >
            Tentar novamente
          </Button>
        </div>
      )}

      <Card className="py-0">
        <Table>
          <TableHeader className="bg-muted/40 [&_th]:h-11 [&_th]:px-4 [&_th]:text-xs [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground">
            <TableRow className="hover:bg-transparent">
              <TableHead>Nome</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead>Tipo</TableHead>
              {/* TODO (Task 04-02): coluna de Ações (Editar / Criar Manager) */}
            </TableRow>
          </TableHeader>
          <TableBody className="[&_td]:h-12 [&_td]:px-4">
            {loading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <TableRow key={`skeleton-${idx}`}>
                  {Array.from({ length: COLUMN_COUNT }).map((__, cidx) => (
                    <TableCell key={cidx}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : sortedOrganizations.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={COLUMN_COUNT}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  Nenhuma organização cadastrada ainda.
                </TableCell>
              </TableRow>
            ) : (
              sortedOrganizations.map((organization) => (
                <TableRow key={organization.id}>
                  <TableCell className="font-medium text-foreground">
                    {organization.name}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {formatCnpj(organization.taxId)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {ORGANIZATION_TYPE_LABELS[organization.type]}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
