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
import { formatCpf } from "@/lib/cpf";
import { listUsers, ROLE_LABELS, ROLES, type User } from "@/lib/users";

import { DeleteUserDialog } from "./delete-user-dialog";
import { UserFormDrawer } from "./user-form-drawer";

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
    (u.cpf ?? "").includes(q)
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
        apiErrorMessage(err, "Não foi possível carregar os usuários."),
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
    (user: User): DataTableRowAction[] => [
      // Prefixo fixo ("Editar usuário") + nome do registro: os testes casam
      // pelo prefixo; o leitor de tela sabe qual linha cada botão afeta.
      {
        label: `Editar usuário ${user.fullName}`,
        icon: Pencil,
        onClick: () => setEditTarget(user),
      },
      {
        label: `Excluir usuário ${user.fullName}`,
        icon: Trash2,
        tone: "destructive",
        onClick: () => setDeleteTarget(user),
      },
    ],
    [],
  );

  const columns = useMemo(() => {
    const baseColumns = [
      columnHelper.accessor("fullName", {
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Nome" disabled={loading} />
        ),
        meta: { cellVariant: "primary" },
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor("email", {
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="E-mail" disabled={loading} />
        ),
        meta: { cellVariant: "secondary" },
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor("cpf", {
        header: "CPF",
        enableSorting: false,
        // Roboto com algarismos tabulares (Figma 97:91), não fonte mono.
        meta: { cellVariant: "secondary", cellClassName: "tabular-nums" },
        cell: (info) =>
          info.getValue() ? formatCpf(info.getValue() as string) : <EmptyValue />,
      }),
      columnHelper.accessor("role", {
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Papel" disabled={loading} />
        ),
        meta: { cellVariant: "primary" },
        cell: (info) => ROLE_LABELS[info.getValue() as Role] ?? info.getValue(),
        filterFn: (row, columnId, filterValue) =>
          !filterValue || row.getValue(columnId) === filterValue,
      }),
    ];

    const actionsColumn = columnHelper.display({
      id: "actions",
      header: "Ações",
      cell: ({ row }) => {
        const user = row.original;
        return <DataTableRowActions actions={rowActions(user)} />;
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
  }, [canManage, loading, rowActions]);

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

  function renderMobileCard(row: Row<User>) {
    const user = row.original;
    return (
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground">{user.fullName}</p>
            <p className="mt-1 break-all text-sm text-muted-foreground">
              {user.email}
            </p>
            <p className="mt-1 text-sm text-muted-foreground tabular-nums">
              {ROLE_LABELS[user.role as Role] ?? user.role}
              {user.cpf ? ` · ${formatCpf(user.cpf)}` : ""}
            </p>
          </div>
          {canManage && (
            <DataTableRowActions
              align="end"
              className="shrink-0"
              actions={rowActions(user)}
            />
          )}
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-section-sm">
      <PageHeader
        title="Usuários"
        description="Gerencie os usuários do sistema."
        actions={
          canManage ? (
            <Button type="button" size="lg" onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden="true" />
              Novo usuário
            </Button>
          ) : undefined
        }
      />

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
        emptyHint={
          canManage
            ? "Cadastre aqui os administradores e técnicos que vão acessar o painel."
            : "Os usuários aparecem aqui quando um administrador os cadastra."
        }
        emptyActionLabel={canManage ? "Criar primeiro usuário" : undefined}
        onEmptyAction={canManage ? () => setCreateOpen(true) : undefined}
        renderMobileCard={renderMobileCard}
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
