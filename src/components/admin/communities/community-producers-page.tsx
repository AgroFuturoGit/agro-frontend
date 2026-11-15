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

import { EmptyValue } from "@/components/admin/empty-value";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import {
  DataTableRowActions,
  type DataTableRowAction,
} from "@/components/data-table/data-table-row-actions";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, userFacingErrorHint, apiErrorMessage } from "@/lib/api";
import { readUserFromStorage, type Role } from "@/lib/auth";
import { getCommunity, type Community } from "@/lib/communities";
import { formatCpf } from "@/lib/cpf";
import { getMyManager } from "@/lib/managers";
import { listProducers, type Producer, producerDisplayName } from "@/lib/producers";

import { DeleteProducerDialog } from "../producers/delete-producer-dialog";
import { ProducerFormDrawer } from "../producers/producer-form-drawer";

type Props = {
  communityId: string;
};

function producerCpf(producer: Producer): string | null {
  return producer.cpf ?? producer.user?.cpf ?? null;
}

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
    producerCpf(producer),
    producer.fullName,
    producer.localName,
  ].some((value) => value?.toLowerCase().includes(query));
}

/**
 * Conformidade (Figma 131:941): status, então `success` (com o ícone
 * padrão CircleCheck) ou `warning`; o texto é o que comunica.
 */
function ComplianceBadge({ isCompliant }: { isCompliant: boolean | null }) {
  if (isCompliant == null) return <EmptyValue />;
  return isCompliant ? (
    <Badge variant="success">Em conformidade</Badge>
  ) : (
    <Badge variant="warning">Pendente</Badge>
  );
}

function FormattedCpf({ producer }: { producer: Producer }) {
  const cpf = producerCpf(producer);
  return cpf ? <>{formatCpf(cpf)}</> : <EmptyValue />;
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
          const hint = apiErrorMessage(err, "");
          setError(
            hint
              ? `Não foi possível identificar a sua organização: ${hint}`
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

  // Mesmos nomes acessíveis na tabela e no card mobile: prefixo fixo
  // ("Editar agricultor", "Excluir agricultor") + nome do registro.
  const rowActions = useCallback(
    (producer: Producer): DataTableRowAction[] => {
      const name = producerDisplayName(producer);
      return [
        {
          label: `Editar agricultor ${name}`,
          icon: Pencil,
          onClick: () => setEditTarget(producer),
        },
        {
          label: `Excluir agricultor ${name}`,
          icon: Trash2,
          tone: "destructive",
          onClick: () => setDeleteTarget(producer),
        },
      ];
    },
    [],
  );

  const columns = useMemo(() => {
    const baseColumns = [
      columnHelper.accessor((producer) => producerDisplayName(producer, ""), {
        id: "fullName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Nome" disabled={loading} />
        ),
        meta: { cellVariant: "primary" },
        cell: ({ row }) => (
          <Link
            href={`/admin/organizacoes/${orgId}/comunidades/${communityId}/produtores/${row.original.id}`}
            className="hover:underline"
          >
            {producerDisplayName(row.original, "") || <EmptyValue />}
          </Link>
        ),
      }),
      columnHelper.accessor((producer) => producer.cpf ?? producer.user?.cpf ?? "", {
        id: "cpf",
        header: "CPF",
        enableSorting: false,
        // Roboto com algarismos tabulares (Figma 131:941), não fonte mono.
        meta: { cellVariant: "secondary", cellClassName: "tabular-nums" },
        cell: ({ row }) => <FormattedCpf producer={row.original} />,
      }),
      columnHelper.accessor("localName", {
        header: "Endereço/Nome local",
        enableSorting: false,
        meta: { cellVariant: "secondary" },
        cell: (info) => info.getValue() || <EmptyValue />,
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
      cell: ({ row }) => <DataTableRowActions actions={rowActions(row.original)} />,
    });

    return (canManage ? [...baseColumns, actionsColumn] : baseColumns) as ColumnDef<
      Producer,
      unknown
    >[];
  }, [canManage, communityId, loading, orgId, rowActions]);

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
              {producerDisplayName(producer, "") || <EmptyValue />}
            </Link>
            <p className="mt-1 text-sm text-muted-foreground tabular-nums">
              <FormattedCpf producer={producer} />
            </p>
            <div className="mt-2">
              <ComplianceBadge isCompliant={producer.isCompliant} />
            </div>
          </div>
          {canManage && (
            <DataTableRowActions
              align="end"
              className="shrink-0"
              actions={rowActions(producer)}
            />
          )}
        </div>
      </Card>
    );
  }

  const description = "Agricultores cadastrados nesta comunidade.";

  if (redirecting) {
    // GESTOR fora da própria organização: nada desta comunidade aparece
    // enquanto o redirecionamento acontece (só a estrutura da página).
    return (
      <div className="flex flex-col gap-section-sm">
        <PageHeader title="Agricultores" description={description} loading />
        <Skeleton aria-hidden="true" className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-section-sm">
      {/* Figma 131:941: breadcrumb de 3 níveis acima do título. */}
      <PageHeader
        breadcrumb={[
          { label: "Organizações", href: "/admin/organizacoes" },
          {
            label: community?.organization.name ?? "Organização",
            href: orgId ? `/admin/organizacoes/${orgId}` : undefined,
          },
          { label: community?.name ?? "Comunidade" },
        ]}
        title={community?.name ?? "Agricultores"}
        description={description}
        loading={loading && !community}
        actions={
          canManage ? (
            <Button
              type="button"
              size="lg"
              onClick={() => setRegisterOpen(true)}
              disabled={community === null}
            >
              <Plus aria-hidden="true" />
              Novo agricultor
            </Button>
          ) : undefined
        }
      />

      <DataTableToolbar
        table={table}
        searchPlaceholder="Buscar por nome, e-mail ou CPF…"
      />

      <DataTable
        table={table}
        columns={columns}
        isLoading={loading}
        hasError={Boolean(error)}
        onRetry={refresh}
        errorHint={userFacingErrorHint(error)}
        hasActiveFilters={Boolean(table.getState().globalFilter)}
        onClearFilters={() => table.setGlobalFilter("")}
        emptyTitle="Nenhum agricultor cadastrado nesta comunidade ainda."
        emptyHint={
          canManage
            ? "Cadastre o primeiro agricultor desta comunidade com os dados pessoais, o endereço e o acesso dele ao painel."
            : "Os agricultores desta comunidade aparecem aqui assim que são cadastrados."
        }
        emptyActionLabel={canManage && community ? "Criar primeiro agricultor" : undefined}
        onEmptyAction={canManage && community ? () => setRegisterOpen(true) : undefined}
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
