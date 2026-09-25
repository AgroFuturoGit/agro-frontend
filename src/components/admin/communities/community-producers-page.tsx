"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  createColumnHelper,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type Row,
  type SortingState,
} from "@tanstack/react-table";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import { readUserFromStorage, type Role } from "@/lib/auth";
import { getCommunity, type Community } from "@/lib/communities";
import { formatCpf } from "@/lib/cpf";
import { getMyManager } from "@/lib/managers";
import { listProducers, type Producer } from "@/lib/producers";

import { DeleteProducerDialog } from "../producers/delete-producer-dialog";
import { ProducerFormDrawer } from "../producers/producer-form-drawer";

type Props = {
  communityId: string;
};

function producersGlobalFilter(
  row: Row<Producer>,
  _columnId: string,
  filterValue: string,
) {
  const query = filterValue.trim().toLowerCase();
  if (!query) return true;

  const producer = row.original;
  return [
    producer.user?.fullName,
    producer.user?.email,
    producer.user?.cpf,
    producer.aliasName,
  ].some((value) => value?.toLowerCase().includes(query));
}

function ComplianceBadge({ isCompliant }: { isCompliant: boolean | null }) {
  if (isCompliant == null) {
    return <span className="text-muted-foreground">—</span>;
  }
  return isCompliant ? (
    <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
      Em conformidade
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
      Pendente
    </span>
  );
}

const columnHelper = createColumnHelper<Producer>();

export function CommunityProducersPage({ communityId }: Props) {
  const router = useRouter();

  const [currentRole, setCurrentRole] = useState<Role | null>(null);
  const [roleResolved, setRoleResolved] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  // `GET /communities/{id}` já devolve a organização aninhada — usada tanto
  // para o breadcrumb quanto para a guarda de ownership do MANAGER.
  const [community, setCommunity] = useState<Community | null>(null);
  const [producers, setProducers] = useState<Producer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [registerOpen, setRegisterOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Producer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Producer | null>(null);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "fullName", desc: false },
  ]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  useEffect(() => {
    setCurrentRole(readUserFromStorage()?.role ?? null);
    setRoleResolved(true);
  }, []);

  const refresh = useCallback(async () => {
    if (!roleResolved) return;

    setLoading(true);
    setError(null);
    try {
      // `GET /communities/{id}` é `hasRole('MANAGER') or hasRole('ADMIN')`
      // no backend (`CommunityController.java`) — TECHNICIAN/FARMER só
      // chegam aqui por URL direta e caem no estado de erro abaixo.
      const communityData = await getCommunity(communityId);

      if (currentRole === "MANAGER") {
        // Guarda de ownership (memória `lesson-backend-hierarchy-ownership`,
        // aplicada por simetria ao nível de Comunidade): o backend não
        // valida que a Comunidade pertence à organização do MANAGER.
        let manager;
        try {
          manager = await getMyManager();
        } catch (err) {
          setCommunity(null);
          setProducers([]);
          setError(
            err instanceof ApiError
              ? `Não foi possível identificar a sua organização: ${err.message}`
              : "Não foi possível identificar a sua organização.",
          );
          return;
        }

        if (manager.organization.id !== communityData.organization.id) {
          setRedirecting(true);
          router.replace(`/admin/organizacoes/${manager.organization.id}`);
          return;
        }
      }

      setCommunity(communityData);
      // `GET /farmers?communityId=` já escopa no backend — nenhum filtro
      // client-side adicional é necessário aqui (diferente da listagem
      // antiga sem escopo por rota).
      setProducers(await listProducers(communityId));
    } catch (err) {
      setCommunity(null);
      setProducers([]);
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar os agricultores desta comunidade.",
      );
    } finally {
      setLoading(false);
    }
  }, [currentRole, roleResolved, communityId, router]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const canManage = currentRole === "ADMIN" || currentRole === "MANAGER";
  const orgId = community?.organization.id;

  const columns = useMemo(() => {
    const baseColumns = [
      columnHelper.accessor((producer) => producer.user?.fullName ?? producer.aliasName ?? "", {
        id: "fullName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Nome" disabled={loading} />
        ),
        cell: ({ row }) => (
          <Link
            href={`/admin/organizacoes/${orgId}/comunidades/${communityId}/produtores/${row.original.id}`}
            className="font-medium text-foreground hover:underline"
          >
            {row.original.user?.fullName ?? row.original.aliasName ?? "—"}
          </Link>
        ),
      }),
      columnHelper.accessor((producer) => producer.user?.cpf ?? "", {
        id: "cpf",
        header: "CPF",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.user?.cpf ? formatCpf(row.original.user.cpf) : "—"}
          </span>
        ),
      }),
      columnHelper.accessor("aliasName", {
        header: "Apelido",
        enableSorting: false,
        cell: (info) => (
          <span className="text-muted-foreground">{info.getValue() ?? "—"}</span>
        ),
      }),
      columnHelper.accessor("isCompliant", {
        header: "Conformidade",
        enableSorting: false,
        cell: (info) => <ComplianceBadge isCompliant={info.getValue()} />,
      }),
    ];

    const actionsColumn = columnHelper.display({
      id: "actions",
      header: "Ações",
      cell: ({ row }) => (
        <div className="inline-flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Editar agricultor"
            onClick={() => setEditTarget(row.original)}
          >
            <Pencil />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Excluir agricultor"
            onClick={() => setDeleteTarget(row.original)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 />
          </Button>
        </div>
      ),
    });

    return (canManage ? [...baseColumns, actionsColumn] : baseColumns) as ColumnDef<
      Producer,
      unknown
    >[];
  }, [canManage, communityId, loading, orgId]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: producers,
    columns,
    state: { sorting, globalFilter, pagination },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    globalFilterFn: producersGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  function renderMobileCard(row: Row<Producer>) {
    const producer = row.original;
    return (
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Link
              href={`/admin/organizacoes/${orgId}/comunidades/${communityId}/produtores/${producer.id}`}
              className="font-medium text-foreground hover:underline"
            >
              {producer.user?.fullName ?? producer.aliasName ?? "—"}
            </Link>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {producer.user?.cpf ? formatCpf(producer.user.cpf) : "—"}
            </p>
            <div className="mt-2">
              <ComplianceBadge isCompliant={producer.isCompliant} />
            </div>
          </div>
          {canManage && (
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditTarget(producer)}
              >
                <Pencil />
                Editar
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Excluir agricultor"
                onClick={() => setDeleteTarget(producer)}
              >
                <Trash2 />
              </Button>
            </div>
          )}
        </div>
      </Card>
    );
  }

  if (redirecting) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb
        items={[
          { label: "Organizações", href: "/admin/organizacoes" },
          {
            label: community?.organization.name ?? "Organização",
            href: orgId ? `/admin/organizacoes/${orgId}` : undefined,
          },
          { label: community?.name ?? "Comunidade" },
        ]}
      />

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            {community?.name ?? "Agricultores"}
          </h2>
          <p className="text-sm text-muted-foreground">
            Agricultores cadastrados nesta comunidade.
          </p>
        </div>
        {canManage && (
          <Button
            type="button"
            size="sm"
            onClick={() => setRegisterOpen(true)}
            disabled={community === null}
          >
            <Plus />
            Novo Agricultor
          </Button>
        )}
      </div>

      <DataTableToolbar
        table={table}
        searchPlaceholder="Buscar por nome, e-mail, CPF ou apelido…"
      />

      <DataTable
        table={table}
        columns={columns}
        isLoading={loading}
        hasError={Boolean(error)}
        onRetry={refresh}
        errorHint={error ?? undefined}
        hasActiveFilters={Boolean(table.getState().globalFilter)}
        onClearFilters={() => table.setGlobalFilter("")}
        emptyTitle="Nenhum agricultor cadastrado nesta comunidade ainda."
        renderMobileCard={renderMobileCard}
      />

      <DataTablePagination table={table} />

      {canManage && (
        <ProducerFormDrawer
          mode="create"
          open={registerOpen}
          onOpenChange={setRegisterOpen}
          onSaved={refresh}
          communities={community ? [community] : []}
          loadingCommunities={community === null}
        />
      )}

      <ProducerFormDrawer
        mode="edit"
        producer={editTarget}
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        onSaved={refresh}
      />

      <DeleteProducerDialog
        producer={deleteTarget}
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onDeleted={refresh}
      />
    </div>
  );
}
