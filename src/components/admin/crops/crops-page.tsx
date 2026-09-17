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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { ApiError } from "@/lib/api";
import { readUserFromStorage, type Role } from "@/lib/auth";
import { listCrops, type Crop } from "@/lib/crops";

import { CropFormDialog } from "./crop-form-dialog";
import { DeleteCropDialog } from "./delete-crop-dialog";
import { PriorityBadge } from "./priority-badge";

/**
 * Busca livre escopada a nome/variedade, case-insensitive — mesma regra da
 * implementação anterior, agora expressa como `globalFilterFn` client-side
 * (o dado em si já vem inteiro do backend; só o lugar do filtro mudou).
 */
function cropsGlobalFilter(row: Row<Crop>, _columnId: string, filterValue: string) {
  const q = filterValue.trim().toLowerCase();
  if (!q) return true;
  const crop = row.original;
  return (
    crop.name.toLowerCase().includes(q) || crop.variety.toLowerCase().includes(q)
  );
}

const columnHelper = createColumnHelper<Crop>();

export function CropsPage() {
  const [crops, setCrops] = useState<Crop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<Role | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Crop | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Crop | null>(null);

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
      // `listCrops()` sem parâmetros: a filtragem (antes feita dentro do
      // wrapper) agora vive inteiramente no `globalFilter`/`columnFilters`
      // da tabela — o dado sempre vem inteiro do backend, como já era de
      // fato (ver `src/lib/crops.ts`).
      const result = await listCrops();
      setCrops(result);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar as culturas.",
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
      columnHelper.accessor("name", {
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Nome" disabled={loading} />
        ),
        cell: (info) => (
          <span className="font-medium text-foreground">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("variety", {
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Variedade" disabled={loading} />
        ),
        cell: (info) => (
          <span className="text-muted-foreground">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("isPriority", {
        header: "Prioritária",
        enableSorting: false,
        cell: (info) => <PriorityBadge isPriority={info.getValue()} />,
        // Controlado pelo checkbox "Somente prioritárias" abaixo da
        // toolbar, não pelo dropdown genérico de `filters` — mantém a
        // mesma interação (checkbox) da implementação anterior.
        filterFn: (row, columnId, filterValue) =>
          !filterValue || row.getValue(columnId) === true,
      }),
    ];

    const actionsColumn = columnHelper.display({
      id: "actions",
      header: "Ações",
      cell: ({ row }) => {
        const crop = row.original;
        return (
          <div className="inline-flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Editar cultura"
              onClick={() => setEditTarget(crop)}
            >
              <Pencil />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Excluir cultura"
              onClick={() => setDeleteTarget(crop)}
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
      Crop,
      unknown
    >[];
  }, [canManage, loading]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: crops,
    columns,
    state: { sorting, columnFilters, globalFilter, pagination },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    globalFilterFn: cropsGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const isPriorityFilterActive = Boolean(
    table.getColumn("isPriority")?.getFilterValue(),
  );

  function renderMobileCard(row: Row<Crop>) {
    const crop = row.original;
    return (
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground">
              {crop.name} — {crop.variety}
            </p>
            <div className="mt-2">
              <PriorityBadge isPriority={crop.isPriority} />
            </div>
          </div>
          {canManage && (
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditTarget(crop)}
              >
                <Pencil />
                Editar
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Excluir cultura"
                onClick={() => setDeleteTarget(crop)}
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
          <h2 className="text-2xl font-semibold tracking-tight">
            Culturas Agrícolas
          </h2>
          <p className="text-sm text-muted-foreground">
            Gerencie as culturas cadastradas no sistema.
          </p>
        </div>
        {canManage && (
          <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus />
            Nova cultura
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          <DataTableToolbar table={table} searchPlaceholder="Buscar por nome ou variedade…" />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="only-priority"
            checked={isPriorityFilterActive}
            onCheckedChange={(checked) =>
              table.getColumn("isPriority")?.setFilterValue(checked === true ? true : undefined)
            }
          />
          <Label htmlFor="only-priority" className="font-normal">
            Somente prioritárias
          </Label>
        </div>
      </div>

      <DataTable
        table={table}
        columns={columns}
        isLoading={loading}
        hasError={Boolean(error)}
        onRetry={refresh}
        hasActiveFilters={Boolean(globalFilter) || isPriorityFilterActive}
        onClearFilters={() => {
          table.setGlobalFilter("");
          table.getColumn("isPriority")?.setFilterValue(undefined);
        }}
        emptyTitle="Nenhuma cultura cadastrada."
        renderMobileCard={renderMobileCard}
      />

      <DataTablePagination table={table} />

      <CropFormDialog
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={refresh}
      />

      <CropFormDialog
        mode="edit"
        crop={editTarget}
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        onSaved={refresh}
      />

      <DeleteCropDialog
        crop={deleteTarget}
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onDeleted={refresh}
      />
    </div>
  );
}
