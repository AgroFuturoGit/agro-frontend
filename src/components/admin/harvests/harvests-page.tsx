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

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { ApiError } from "@/lib/api";
import { readUserFromStorage, type Role } from "@/lib/auth";
import {
  formatHarvestDate,
  listHarvests,
  type Harvest,
} from "@/lib/harvests";

import { DeleteHarvestDialog } from "./delete-harvest-dialog";
import { HarvestFormDialog } from "./harvest-form-dialog";

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar as safras.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const columns = useMemo(() => {
    const baseColumns = [
      columnHelper.accessor("label", {
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Rótulo" disabled={loading} />
        ),
        cell: (info) => (
          <span className="font-medium text-foreground">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("startDate", {
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Início" disabled={loading} />
        ),
        cell: (info) => (
          <span className="text-muted-foreground">
            {formatHarvestDate(info.getValue())}
          </span>
        ),
      }),
      columnHelper.accessor("endDate", {
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Término" disabled={loading} />
        ),
        cell: (info) => (
          <span className="text-muted-foreground">
            {formatHarvestDate(info.getValue())}
          </span>
        ),
      }),
    ];

    const actionsColumn = columnHelper.display({
      id: "actions",
      header: "Ações",
      cell: ({ row }) => {
        const harvest = row.original;
        return (
          <div className="inline-flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Editar safra"
              onClick={() => setEditTarget(harvest)}
            >
              <Pencil />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Excluir safra"
              onClick={() => setDeleteTarget(harvest)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 />
            </Button>
          </div>
        );
      },
    });

    // `createColumnHelper` infere um TValue concreto por coluna; o
    // `<DataTable>` genérico é parametrizado por um único `TValue` para o
    // array inteiro — mesmo boundary cast usado em `UsersPage`.
    return (canManage ? [...baseColumns, actionsColumn] : baseColumns) as ColumnDef<
      Harvest,
      unknown
    >[];
  }, [canManage, loading]);

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
            <p className="mt-1 text-sm text-muted-foreground">
              {formatHarvestDate(harvest.startDate)} —{" "}
              {formatHarvestDate(harvest.endDate)}
            </p>
          </div>
          {canManage && (
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Editar safra"
                onClick={() => setEditTarget(harvest)}
              >
                <Pencil />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Excluir safra"
                onClick={() => setDeleteTarget(harvest)}
              >
                <Trash2 />
              </Button>
            </div>
          )}
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Safras</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie as safras cadastradas no sistema.
          </p>
        </div>
        {canManage && (
          <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus />
            Nova safra
          </Button>
        )}
      </div>

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
        renderMobileCard={renderMobileCard}
      />

      <DataTablePagination table={table} />

      <HarvestFormDialog
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={refresh}
      />

      <HarvestFormDialog
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
