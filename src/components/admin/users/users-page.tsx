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
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { ApiError } from "@/lib/api";
import { readUserFromStorage, type Role } from "@/lib/auth";
import { formatCpf } from "@/lib/cpf";
import { listUsers, ROLE_LABELS, ROLES, type User } from "@/lib/users";

import { DeleteUserDialog } from "./delete-user-dialog";
import { UserFormDrawer } from "./user-form-drawer";

function formatDate(value: string | null): string {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

/**
 * Busca livre escopada a nome/e-mail/CPF, case-insensitive — regra de
 * negócio de `domain.md`.
 */
function usersGlobalFilter(row: Row<User>, _columnId: string, filterValue: string) {
  const q = filterValue.trim().toLowerCase();
  if (!q) return true;
  const u = row.original;
  return (
    u.fullName.toLowerCase().includes(q) ||
    u.email.toLowerCase().includes(q) ||
    u.cpf.includes(q)
  );
}

const columnHelper = createColumnHelper<User>();

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<Role | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

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

  const canManage = currentRole === "ADMIN";

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listUsers();
      setUsers(data);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar os usuários.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const columns = useMemo(() => {
    const baseColumns = [
      columnHelper.accessor("fullName", {
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Nome" disabled={loading} />
        ),
        cell: (info) => (
          <span className="font-medium text-foreground">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("email", {
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="E-mail" disabled={loading} />
        ),
        cell: (info) => (
          <span className="text-muted-foreground">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("cpf", {
        header: "CPF",
        enableSorting: false,
        cell: (info) => (
          <span className="font-mono text-xs text-muted-foreground">
            {formatCpf(info.getValue())}
          </span>
        ),
      }),
      columnHelper.accessor("role", {
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Papel" disabled={loading} />
        ),
        cell: (info) => ROLE_LABELS[info.getValue() as Role] ?? info.getValue(),
        filterFn: (row, columnId, filterValue) =>
          !filterValue || row.getValue(columnId) === filterValue,
      }),
      columnHelper.accessor("dateOfBirth", {
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Nascimento" disabled={loading} />
        ),
        cell: (info) => (
          <span className="text-muted-foreground">
            {formatDate(info.getValue())}
          </span>
        ),
      }),
    ];

    const actionsColumn = columnHelper.display({
      id: "actions",
      header: "Ações",
      cell: ({ row }) => {
        const user = row.original;
        return (
          <div className="inline-flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Editar usuário"
              onClick={() => setEditTarget(user)}
            >
              <Pencil />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Excluir usuário"
              onClick={() => setDeleteTarget(user)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 />
            </Button>
          </div>
        );
      },
    });

    // `createColumnHelper` infere um TValue concreto por coluna (string,
    // Role, string | null…); o `<DataTable>` genérico é parametrizado por
    // um único `TValue` para o array inteiro — a normalização abaixo é o
    // mesmo boundary cast usado pelos exemplos oficiais do TanStack Table.
    return (canManage ? [...baseColumns, actionsColumn] : baseColumns) as ColumnDef<
      User,
      unknown
    >[];
  }, [canManage, loading]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: users,
    columns,
    state: { sorting, columnFilters, globalFilter, pagination },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    globalFilterFn: usersGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Usuários</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie os usuários do sistema.
          </p>
        </div>
        {canManage && (
          <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus />
            Novo usuário
          </Button>
        )}
      </div>

      <DataTableToolbar
        table={table}
        searchPlaceholder="Buscar por nome, e-mail ou CPF…"
        filters={[
          {
            columnId: "role",
            label: "Papel",
            options: ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] })),
          },
        ]}
      />

      <DataTable
        table={table}
        columns={columns}
        isLoading={loading}
        hasError={Boolean(error)}
        onRetry={refresh}
        hasActiveFilters={
          Boolean(table.getState().globalFilter) ||
          table.getState().columnFilters.length > 0
        }
        onClearFilters={() => {
          table.setGlobalFilter("");
          table.resetColumnFilters();
        }}
        emptyTitle="Nenhum usuário cadastrado ainda."
      />

      <DataTablePagination table={table} />

      <UserFormDrawer
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={refresh}
      />

      <UserFormDrawer
        mode="edit"
        user={editTarget}
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        onSaved={refresh}
      />

      <DeleteUserDialog
        user={deleteTarget}
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onDeleted={refresh}
      />
    </div>
  );
}
