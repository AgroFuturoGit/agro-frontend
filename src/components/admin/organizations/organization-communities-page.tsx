"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
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

import { PageHeader } from "@/components/admin/page-header";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import {
  DataTableRowActions,
  type DataTableRowAction,
} from "@/components/data-table/data-table-row-actions";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, userFacingErrorHint } from "@/lib/api";
import { readUserFromStorage, type Role } from "@/lib/auth";
import { listCommunities, type Community } from "@/lib/communities";
import { getMyManager } from "@/lib/managers";
import { getOrganization, type Organization } from "@/lib/organizations";

import { CommunityFormDrawer } from "../communities/community-form-drawer";

type Props = {
  orgId: string;
};

function communitiesGlobalFilter(
  row: Row<Community>,
  _columnId: string,
  filterValue: string,
) {
  const query = filterValue.trim().toLowerCase();
  if (!query) return true;
  return row.original.name.toLowerCase().includes(query);
}

const columnHelper = createColumnHelper<Community>();

export function OrganizationCommunitiesPage({ orgId }: Props) {
  const router = useRouter();

  const [currentRole, setCurrentRole] = useState<Role | null>(null);
  const [roleResolved, setRoleResolved] = useState(false);

  // Nome da organização exibido no breadcrumb/cabeçalho. Resolvido de forma
  // diferente por role (ver `refresh`) porque `GET /organizations/{id}` é
  // `hasRole('ADMIN')` no backend (`OrganizationController.java`) — MANAGER
  // NUNCA pode chamá-lo, então usa a organização já embutida em
  // `GET /managers/me`.
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Enquanto o MANAGER não tiver a própria organização confirmada, nada é
  // buscado nem exibido — falha fechada (mesmo espírito da guarda de
  // ownership de `lesson-backend-hierarchy-ownership`).
  const [redirecting, setRedirecting] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [dialogCommunity, setDialogCommunity] = useState<Community | null>(
    null,
  );

  const [sorting, setSorting] = useState<SortingState>([
    { id: "name", desc: false },
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
      if (currentRole === "MANAGER") {
        // Guarda de ownership OBRIGATÓRIA (memória
        // `lesson-backend-hierarchy-ownership`): o backend não impede um
        // MANAGER de operar sobre a organização de outro MANAGER via URL
        // direta. `orgId` da rota é comparado com a organização real do
        // usuário logado ANTES de qualquer dado ser buscado/exibido.
        let manager;
        try {
          manager = await getMyManager();
        } catch (err) {
          setOrganization(null);
          setCommunities([]);
          setError(
            err instanceof ApiError
              ? `Não foi possível identificar a sua organização: ${err.message}`
              : "Não foi possível identificar a sua organização. Sem ela, as comunidades não podem ser listadas.",
          );
          return;
        }

        if (manager.organization.id !== orgId) {
          setRedirecting(true);
          router.replace(`/admin/organizacoes/${manager.organization.id}`);
          return;
        }

        setOrganization(manager.organization);
        setCommunities(await listCommunities(orgId));
        return;
      }

      // ADMIN: caminho normal. TECHNICIAN/FARMER só chegam aqui por URL
      // direta — `GET /organizations/{id}` e `GET /communities` recusam as
      // duas roles no backend real, então a tela cai no estado de erro
      // (comportamento aceito e documentado, mesmo padrão já usado para
      // outras lacunas de RBAC do backend nesta base de código).
      const [organizationData, communitiesData] = await Promise.all([
        getOrganization(orgId),
        listCommunities(orgId),
      ]);
      setOrganization(organizationData);
      setCommunities(communitiesData);
    } catch (err) {
      setOrganization(null);
      setCommunities([]);
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar as comunidades desta organização.",
      );
    } finally {
      setLoading(false);
    }
  }, [currentRole, roleResolved, orgId, router]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const canManage = currentRole === "ADMIN" || currentRole === "MANAGER";

  function openCreateDialog() {
    setDialogMode("create");
    setDialogCommunity(null);
    setDialogOpen(true);
  }

  // Mesmo nome acessível na tabela e no card mobile: prefixo fixo
  // ("Editar comunidade", que os testes casam) + nome do registro.
  const rowActions = useCallback(
    (community: Community): DataTableRowAction[] => [
      {
        label: `Editar comunidade ${community.name}`,
        icon: Pencil,
        onClick: () => {
          setDialogMode("edit");
          setDialogCommunity(community);
          setDialogOpen(true);
        },
      },
    ],
    [],
  );

  const columns = useMemo(() => {
    const baseColumns = [
      columnHelper.accessor("name", {
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Nome" disabled={loading} />
        ),
        meta: { cellVariant: "primary" },
        cell: ({ row }) => (
          <Link
            href={`/admin/organizacoes/${orgId}/comunidades/${row.original.id}`}
            className="hover:underline"
          >
            {row.original.name}
          </Link>
        ),
      }),
    ];

    const actionsColumn = columnHelper.display({
      id: "actions",
      header: "Ações",
      cell: ({ row }) => <DataTableRowActions actions={rowActions(row.original)} />,
    });

    return (canManage ? [...baseColumns, actionsColumn] : baseColumns) as ColumnDef<
      Community,
      unknown
    >[];
  }, [canManage, loading, orgId, rowActions]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: communities,
    columns,
    state: { sorting, globalFilter, pagination },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    globalFilterFn: communitiesGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  function renderMobileCard(row: Row<Community>) {
    const community = row.original;
    return (
      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <Link
            href={`/admin/organizacoes/${orgId}/comunidades/${community.id}`}
            className="min-w-0 flex-1 font-medium text-foreground hover:underline"
          >
            {community.name}
          </Link>
          {canManage && (
            <DataTableRowActions
              align="end"
              className="shrink-0"
              actions={rowActions(community)}
            />
          )}
        </div>
      </Card>
    );
  }

  const breadcrumb = [
    { label: "Organizações", href: "/admin/organizacoes" },
    { label: organization?.name ?? "Organização" },
  ];
  const description = "Comunidades cadastradas nesta organização.";

  if (redirecting) {
    // GESTOR fora da própria organização: nada desta organização aparece
    // enquanto o redirecionamento acontece (só a estrutura da página).
    return (
      <div className="flex flex-col gap-section-sm">
        <PageHeader title="Comunidades" description={description} loading />
        <Skeleton aria-hidden="true" className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-section-sm">
      {/* Figma 131:1110: breadcrumb acima do título (nome da organização). */}
      <PageHeader
        breadcrumb={breadcrumb}
        title={organization?.name ?? "Comunidades"}
        description={description}
        loading={loading && !organization}
        actions={
          canManage ? (
            <Button type="button" size="lg" onClick={openCreateDialog}>
              <Plus aria-hidden="true" />
              Nova comunidade
            </Button>
          ) : undefined
        }
      />

      <DataTableToolbar table={table} searchPlaceholder="Buscar por nome…" />

      <DataTable
        table={table}
        columns={columns}
        isLoading={loading}
        hasError={Boolean(error)}
        onRetry={refresh}
        errorHint={userFacingErrorHint(error)}
        hasActiveFilters={Boolean(table.getState().globalFilter)}
        onClearFilters={() => table.setGlobalFilter("")}
        emptyTitle="Nenhuma comunidade cadastrada nesta organização ainda."
        emptyHint={
          canManage
            ? "Cadastre a primeira comunidade desta organização informando o nome dela."
            : "As comunidades aparecem aqui quando um administrador ou gestor as cadastra."
        }
        emptyActionLabel={canManage ? "Criar primeira comunidade" : undefined}
        onEmptyAction={canManage ? openCreateDialog : undefined}
        renderMobileCard={renderMobileCard}
      />

      <DataTablePagination table={table} />

      {canManage && currentRole && (
        <CommunityFormDrawer
          mode={dialogMode}
          role={currentRole}
          organizationId={orgId}
          community={dialogCommunity}
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setDialogCommunity(null);
          }}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
