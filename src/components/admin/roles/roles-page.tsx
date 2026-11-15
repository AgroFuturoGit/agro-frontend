"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createColumnHelper,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
} from "@tanstack/react-table";

import { PageHeader } from "@/components/admin/page-header";
import { DataTable } from "@/components/data-table/data-table";
import { Card } from "@/components/ui/card";
import { ApiError } from "@/lib/api";
import { listRoles, type BackendRole } from "@/lib/roles";
import { ROLE_LABELS } from "@/lib/users";

const columnHelper = createColumnHelper<BackendRole>();

/**
 * Perfis (Figma 148:1686): card de tabela padrão, sem toolbar, sem paginação
 * (são os 4 papéis fixos do backend) e sem ações. Reaproveita o `DataTable`
 * para herdar os estados de carregamento, vazio, erro e o modo mobile.
 */
export function RolesPage() {
  const [roles, setRoles] = useState<BackendRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listRoles();
      setRoles(data);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar os perfis.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const columns = useMemo(
    () =>
      [
        columnHelper.accessor((role) => ROLE_LABELS[role.name] ?? role.name, {
          id: "label",
          header: "Perfil",
          enableSorting: false,
          meta: { cellVariant: "primary" },
        }),
        columnHelper.accessor("name", {
          header: "Identificador",
          enableSorting: false,
          meta: { cellVariant: "secondary" },
        }),
        columnHelper.accessor("description", {
          header: "Descrição",
          enableSorting: false,
          meta: { cellVariant: "primary" },
        }),
      ] as ColumnDef<BackendRole, unknown>[],
    [],
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: roles,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (role) => role.name,
  });

  function renderMobileCard(row: Row<BackendRole>) {
    const role = row.original;
    return (
      <Card className="gap-1 p-4">
        <p className="font-medium text-foreground">
          {ROLE_LABELS[role.name] ?? role.name}
        </p>
        <p className="text-sm text-muted-foreground">{role.name}</p>
        <p className="text-sm text-foreground">{role.description}</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-section-sm">
      <PageHeader
        title="Perfis"
        description="Perfis disponíveis no sistema. A definição dos perfis é controlada pelo backend."
      />

      <DataTable
        table={table}
        columns={columns}
        isLoading={loading}
        hasError={Boolean(error)}
        onRetry={refresh}
        emptyTitle="Nenhum perfil disponível."
        emptyHint="Os perfis são definidos pelo backend. Se a lista continuar vazia, fale com o suporte."
        renderMobileCard={renderMobileCard}
      />
    </div>
  );
}
