"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  createColumnHelper,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type PaginationState,
  type Row,
  type SortingState,
} from "@tanstack/react-table";

import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import {
  DataTableRowActions,
  type DataTableRowAction,
} from "@/components/data-table/data-table-row-actions";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { apiErrorMessage } from "@/lib/api";
import { readUserFromStorage, type Role } from "@/lib/auth";
import {
  formatHarvestDate,
  listHarvests,
  type Harvest,
} from "@/lib/harvests";

import { DeleteHarvestDialog } from "./delete-harvest-dialog";
import { HarvestFormDrawer } from "./harvest-form-drawer";

/**
 * Busca livre escopada ao rótulo, case-insensitive — mesma regra da
 * implementação anterior, agora expressa como `globalFilterFn` client-side.
 */
function harvestsGlobalFilter(row: Row<Harvest>, _columnId: string, filterValue: string) {
  const q = filterValue.trim().toLowerCase();
  if (!q) return true;
  return row.original.label.toLowerCase().includes(q);
}

const columnHelper = createColumnHelper<Harvest>();

export function HarvestsPage() {
  const [harvests, setHarvests] = useState<Harvest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<Role | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Harvest | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Harvest | null>(null);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  useEffect(() => {
    setCurrentRole(readUserFromStorage()?.role ?? null);
  }, []);

  const canManage = currentRole === "ADMIN" || currentRole === "TECHNICIAN";

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listHarvests();
      setHarvests(result);
    } catch (err) {
      setError(
        apiErrorMessage(err, "Não foi possível carregar as safras."),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Mesmos nomes acessíveis na tabela e nos cards mobile (e2e/unit).
  const rowActions = useCallback(
    (harvest: Harvest): DataTableRowAction[] => [
      // Prefixo fixo ("Editar safra") + rótulo do registro: os testes casam
      // pelo prefixo; o leitor de tela sabe qual linha cada botão afeta.
      {
        label: `Editar safra ${harvest.label}`,
        icon: Pencil,
        onClick: () => setEditTarget(harvest),
      },
      {
        label: `Excluir safra ${harvest.label}`,
        icon: Trash2,
        tone: "destructive",
        onClick: () => setDeleteTarget(harvest),
      },
    ],
    [],
  );

  const columns = useMemo(() => {
    const baseColumns = [
      columnHelper.accessor("label", {
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Rótulo" disabled={loading} />
        ),
        meta: { cellVariant: "primary" },
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor("startDate", {
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Início" disabled={loading} />
        ),
        meta: { cellVariant: "secondary", cellClassName: "tabular-nums" },
        cell: (info) => formatHarvestDate(info.getValue()),
      }),
      columnHelper.accessor("endDate", {
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Término" disabled={loading} />
        ),
        meta: { cellVariant: "secondary", cellClassName: "tabular-nums" },
        cell: (info) => formatHarvestDate(info.getValue()),
      }),
    ];

    const actionsColumn = columnHelper.display({
      id: "actions",
      header: "Ações",
      cell: ({ row }) => {
        return <DataTableRowActions actions={rowActions(row.original)} />;
      },
    });

    // `createColumnHelper` infere um TValue concreto por coluna; o
    // `<DataTable>` genérico é parametrizado por um único `TValue` para o
    // array inteiro — mesmo boundary cast usado em `UsersPage`.
    return (canManage ? [...baseColumns, actionsColumn] : baseColumns) as ColumnDef<
      Harvest,
      unknown
    >[];
  }, [canManage, loading, rowActions]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: harvests,
    columns,
    state: { sorting, columnFilters, globalFilter, pagination },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    globalFilterFn: harvestsGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  function renderMobileCard(row: Row<Harvest>) {
    const harvest = row.original;
    return (
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground">{harvest.label}</p>
            <p className="mt-1 text-sm text-muted-foreground tabular-nums">
              {formatHarvestDate(harvest.startDate)} —{" "}
              {formatHarvestDate(harvest.endDate)}
            </p>
          </div>
          {/* Ações como filhas diretas do mesmo container do rótulo (e2e
              sobe dois níveis a partir do rótulo para achá-las). */}
          {canManage && (
            <DataTableRowActions
              align="end"
              className="shrink-0"
              actions={rowActions(harvest)}
            />
          )}
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-section-sm">
      <PageHeader
        title="Safras"
        description="Gerencie as safras cadastradas no sistema."
        actions={
          canManage ? (
            <Button type="button" size="lg" onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden="true" />
              Nova safra
            </Button>
          ) : undefined
        }
      />

      <DataTableToolbar table={table} searchPlaceholder="Buscar por rótulo…" />

      <DataTable
        table={table}
        columns={columns}
        isLoading={loading}
        hasError={Boolean(error)}
        onRetry={refresh}
        hasActiveFilters={Boolean(globalFilter)}
        onClearFilters={() => table.setGlobalFilter("")}
        emptyTitle="Nenhuma safra cadastrada."
        emptyHint={
          canManage
            ? "Cadastre a primeira safra para organizar os planos de produção por período."
            : "As safras aparecem aqui quando um administrador ou técnico as cadastra."
        }
        emptyActionLabel={canManage ? "Criar primeira safra" : undefined}
        onEmptyAction={canManage ? () => setCreateOpen(true) : undefined}
        renderMobileCard={renderMobileCard}
      />

      <DataTablePagination table={table} />

      <HarvestFormDrawer
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={refresh}
      />

      <HarvestFormDrawer
        mode="edit"
        harvest={editTarget}
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        onSaved={refresh}
      />

      <DeleteHarvestDialog
        harvest={deleteTarget}
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onDeleted={refresh}
      />
    </div>
  );
}
