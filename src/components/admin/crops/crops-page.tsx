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

import { EmptyValue } from "@/components/admin/empty-value";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import {
  DataTableRowActions,
  type DataTableRowAction,
} from "@/components/data-table/data-table-row-actions";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { ApiError } from "@/lib/api";
import { readUserFromStorage, type Role } from "@/lib/auth";
import {
  HARVEST_TYPE_LABELS,
  UNIT_NAMES,
  cropDisplayName,
  listCrops,
  type Crop,
} from "@/lib/crops";

import { CropFormDrawer } from "./crop-form-drawer";
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
    refresh();
  }, [refresh]);

  // Prefixo fixo ("Editar cultura") + "nome — variedade" (há nomes
  // repetidos, ex. Milho BR-106 × AG 1051). Os testes casam pelo prefixo; o
  // e2e mobile procura "Editar" por substring.
  const rowActions = useCallback(
    (crop: Crop): DataTableRowAction[] => {
      const name = cropDisplayName(crop);
      return [
        { label: `Editar cultura ${name}`, icon: Pencil, onClick: () => setEditTarget(crop) },
        {
          label: `Excluir cultura ${name}`,
          icon: Trash2,
          tone: "destructive",
          onClick: () => setDeleteTarget(crop),
        },
      ];
    },
    [],
  );

  const columns = useMemo(() => {
    const baseColumns = [
      columnHelper.accessor("name", {
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Nome" disabled={loading} />
        ),
        meta: { cellVariant: "primary" },
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor("variety", {
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Variedade" disabled={loading} />
        ),
        meta: { cellVariant: "secondary" },
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor((crop) => crop.harvestType ?? "", {
        id: "harvestType",
        header: "Colheita",
        enableSorting: false,
        meta: { cellVariant: "secondary" },
        cell: ({ row }) =>
          row.original.harvestType
            ? HARVEST_TYPE_LABELS[row.original.harvestType]
            : <EmptyValue />,
      }),
      columnHelper.accessor((crop) => crop.unit ?? "", {
        id: "unit",
        header: "Unidade",
        enableSorting: false,
        meta: { cellVariant: "secondary" },
        cell: ({ row }) =>
          row.original.unit ? UNIT_NAMES[row.original.unit] : <EmptyValue />,
      }),
      columnHelper.accessor("isPriority", {
        header: "Prioritária",
        enableSorting: false,
        cell: (info) => <PriorityBadge isPriority={info.getValue()} />,
        // Controlado pelo checkbox "Somente prioritárias" dentro do card da
        // toolbar (slot `extra`), não pelo dropdown genérico de `filters` —
        // mantém a mesma interação (checkbox) da implementação anterior.
        filterFn: (row, columnId, filterValue) =>
          !filterValue || row.getValue(columnId) === true,
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
      Crop,
      unknown
    >[];
  }, [canManage, loading, rowActions]);

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
  // Um único ponto para desmarcar "Somente prioritárias" (chip, "Limpar" da
  // toolbar e "Limpar filtros" do vazio).
  const clearPriorityFilter = () =>
    table.getColumn("isPriority")?.setFilterValue(undefined);

  function renderMobileCard(row: Row<Crop>) {
    const crop = row.original;
    return (
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground">{cropDisplayName(crop)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {crop.harvestType ? HARVEST_TYPE_LABELS[crop.harvestType] : <EmptyValue />} ·{" "}
              {crop.unit ? UNIT_NAMES[crop.unit] : <EmptyValue />}
            </p>
            <div className="mt-2">
              <PriorityBadge isPriority={crop.isPriority} />
            </div>
          </div>
          {/* Ações filhas diretas do mesmo container do nome: o e2e sobe
              dois níveis a partir do nome para achá-las. */}
          {canManage && (
            <DataTableRowActions
              align="end"
              className="shrink-0"
              actions={rowActions(crop)}
            />
          )}
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-section-sm">
      <PageHeader
        title="Culturas Agrícolas"
        description="Gerencie as culturas cadastradas no sistema."
        actions={
          canManage ? (
            <Button type="button" size="lg" onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden="true" />
              Nova cultura
            </Button>
          ) : undefined
        }
      />

      <DataTableToolbar
        table={table}
        searchPlaceholder="Buscar por nome ou variedade…"
        extraFilter={{
          active: isPriorityFilterActive,
          label: "Somente prioritárias",
          onClear: clearPriorityFilter,
        }}
        extra={
          // Figma 109:498: à direita, na mesma linha da busca; no mobile
          // quebra para a linha de baixo. Alvo de toque = altura de controle.
          <div className="flex min-h-control items-center gap-2 sm:ml-auto">
            <Checkbox
              id="only-priority"
              checked={isPriorityFilterActive}
              onCheckedChange={(checked) =>
                checked === true
                  ? table.getColumn("isPriority")?.setFilterValue(true)
                  : clearPriorityFilter()
              }
            />
            <Label htmlFor="only-priority" className="font-medium">
              Somente prioritárias
            </Label>
          </div>
        }
      />

      <DataTable
        table={table}
        columns={columns}
        isLoading={loading}
        hasError={Boolean(error)}
        onRetry={refresh}
        hasActiveFilters={Boolean(globalFilter) || isPriorityFilterActive}
        onClearFilters={() => {
          table.setGlobalFilter("");
          clearPriorityFilter();
        }}
        emptyTitle="Nenhuma cultura cadastrada."
        emptyHint={
          canManage
            ? "Cadastre as culturas (nome e variedade) que vão compor os planos de produção."
            : "As culturas aparecem aqui quando um administrador ou técnico as cadastra."
        }
        emptyActionLabel={canManage ? "Criar primeira cultura" : undefined}
        onEmptyAction={canManage ? () => setCreateOpen(true) : undefined}
        renderMobileCard={renderMobileCard}
      />

      <DataTablePagination table={table} />

      <CropFormDrawer
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={refresh}
      />

      <CropFormDrawer
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
