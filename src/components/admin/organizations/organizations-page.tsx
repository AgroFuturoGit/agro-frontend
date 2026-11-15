"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Plus, UserPlus } from "lucide-react";
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
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import {
  DataTablePagination,
  needsPagination,
} from "@/components/data-table/data-table-pagination";
import {
  DataTableRowActions,
  type DataTableRowAction,
} from "@/components/data-table/data-table-row-actions";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, userFacingErrorHint, apiErrorMessage } from "@/lib/api";
import { readUserFromStorage, type Role } from "@/lib/auth";
import { formatCnpj } from "@/lib/cnpj";
import { getMyManager } from "@/lib/managers";
import {
  listOrganizations,
  ORGANIZATION_TYPE_LABELS,
  type Organization,
  type OrganizationType,
} from "@/lib/organizations";
import { getMyProducer, type Producer, producerDisplayName } from "@/lib/producers";
import { getMyAssignedProducers } from "@/lib/technicians";

import { ManagerRegisterDrawer } from "./manager-register-drawer";
import { OrganizationFormDrawer } from "./organization-form-drawer";

/** Busca livre por nome ou CNPJ (com ou sem máscara), case-insensitive. */
function organizationsGlobalFilter(
  row: Row<Organization>,
  _columnId: string,
  filterValue: string,
) {
  const query = filterValue.trim().toLowerCase();
  if (!query) return true;

  const organization = row.original;
  const digits = query.replace(/\D/g, "");
  return (
    organization.name.toLowerCase().includes(query) ||
    (digits !== "" && organization.taxId.replace(/\D/g, "").includes(digits))
  );
}

const columnHelper = createColumnHelper<Organization>();
const producerColumnHelper = createColumnHelper<Producer>();

/** Rota de planos do agricultor; `null` quando faltam comunidade/organização. */
function producerPlansHref(producer: Producer): string | null {
  const community = producer.community;
  const organization = community?.organization;
  if (!community || !organization) return null;
  return `/admin/organizacoes/${organization.id}/comunidades/${community.id}/produtores/${producer.id}`;
}

/** Nome do agricultor como link para os planos (texto puro sem rota). */
function ProducerNameLink({ producer }: { producer: Producer }) {
  const name = producerDisplayName(producer, "");
  if (!name) return <EmptyValue />;
  const href = producerPlansHref(producer);
  return href ? (
    <Link href={href} className="font-medium text-foreground hover:underline">
      {name}
    </Link>
  ) : (
    <>{name}</>
  );
}

/**
 * `/admin/organizacoes` é o único ponto de entrada da hierarquia
 * Organização → Comunidade → Produtor → Planos (ver plano `navegacao-
 * cascata-organizacoes`). ADMIN vê a lista completa e escolhe; MANAGER e
 * FARMER têm exatamente um recurso possível e são redirecionados
 * automaticamente para ele — nunca escolhem pela UI.
 *
 * TECHNICIAN não navega pela cascata institucional (sem vínculo fixo a uma
 * organização — ver `issues-fix-back.pdf` itens 7/8): fica na mesma URL,
 * mas em vez da lista de organizações, vê a lista de produtores atribuídos
 * a ele via `GET /technicians/me/farmers` (relação N:N
 * `TechnicalAssistance`). Cada linha leva para a mesma rota de planos
 * usada pelas outras roles (`/admin/organizacoes/{orgId}/comunidades/
 * {communityId}/produtores/{producerId}`) — os links de organização/
 * comunidade no breadcrumb dessa página não funcionam para TECHNICIAN
 * (`GET /organizations/{id}` e `GET /communities/{id}` continuam
 * `ADMIN`/`MANAGER` apenas), mas a listagem de planos em si já tolera
 * isso (`producer-plans-page.tsx` cai em rótulos genéricos quando não
 * consegue resolver os nomes).
 *
 * Visual (Figma 124:232 ADM e 135:898 TÉCNICO): `PageHeader`, toolbar,
 * tabela e paginação em cards separados; a lista do técnico é o card de
 * tabela padrão sem toolbar.
 */
export function OrganizationsPage() {
  const router = useRouter();

  const [currentRole, setCurrentRole] = useState<Role | null>(null);
  const [roleResolved, setRoleResolved] = useState(false);

  const [redirectError, setRedirectError] = useState<string | null>(null);

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [assignedProducers, setAssignedProducers] = useState<Producer[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Organization | null>(null);
  const [managerTarget, setManagerTarget] = useState<Organization | null>(
    null,
  );

  const [sorting, setSorting] = useState<SortingState>([
    { id: "name", desc: false },
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [producersPagination, setProducersPagination] =
    useState<PaginationState>({ pageIndex: 0, pageSize: 10 });

  useEffect(() => {
    setCurrentRole(readUserFromStorage()?.role ?? null);
    setRoleResolved(true);
  }, []);

  const resolveAndLoad = useCallback(async () => {
    if (!roleResolved) return;

    if (currentRole === "MANAGER") {
      setRedirectError(null);
      try {
        const manager = await getMyManager();
        router.replace(`/admin/organizacoes/${manager.organization.id}`);
      } catch (err) {
        const hint = apiErrorMessage(err, "");
        setRedirectError(
          hint
            ? `Não foi possível identificar a sua organização: ${hint}`
            : "Não foi possível identificar a sua organização.",
        );
      }
      return;
    }

    if (currentRole === "FARMER") {
      setRedirectError(null);
      try {
        const producer = await getMyProducer();
        const community = producer.community;
        if (!community || !community.organization) {
          setRedirectError(
            "Não foi possível identificar a sua comunidade/organização. Contate o suporte.",
          );
          return;
        }
        router.replace(
          `/admin/organizacoes/${community.organization.id}/comunidades/${community.id}/produtores/${producer.id}`,
        );
      } catch (err) {
        const hint = apiErrorMessage(err, "");
        setRedirectError(
          hint
            ? `Não foi possível identificar o seu agricultor: ${hint}`
            : "Não foi possível identificar o seu agricultor.",
        );
      }
      return;
    }

    if (currentRole === "TECHNICIAN") {
      setLoading(true);
      setError(null);
      try {
        const data = await getMyAssignedProducers();
        setAssignedProducers(data);
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : "Não foi possível carregar os agricultores atendidos.",
        );
      } finally {
        setLoading(false);
      }
      return;
    }

    // ADMIN: lista completa de organizações, navegação por link em cada linha.
    setLoading(true);
    setError(null);
    try {
      const data = await listOrganizations();
      setOrganizations(data);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar as organizações.",
      );
    } finally {
      setLoading(false);
    }
  }, [currentRole, roleResolved, router]);

  useEffect(() => {
    resolveAndLoad();
  }, [resolveAndLoad]);

  const sortedAssignedProducers = useMemo(
    () =>
      [...assignedProducers].sort((a, b) =>
        producerDisplayName(a, "").localeCompare(
          producerDisplayName(b, ""),
        ),
      ),
    [assignedProducers],
  );

  // Escrita de Organização (criar/editar/criar Manager) é `hasRole('ADMIN')`
  // no backend real (`OrganizationController.java`) — TECHNICIAN só lê.
  const canManage = currentRole === "ADMIN";

  // Mesmos nomes acessíveis na tabela e nos cards mobile. Prefixo fixo
  // ("Editar organização", "Criar gestor para") + nome do registro: os testes
  // casam pelo prefixo e o leitor de tela sabe qual linha cada botão afeta.
  const rowActions = useCallback(
    (organization: Organization): DataTableRowAction[] => [
      {
        label: `Editar organização ${organization.name}`,
        icon: Pencil,
        onClick: () => setEditTarget(organization),
      },
      {
        label: `Criar gestor para ${organization.name}`,
        icon: UserPlus,
        onClick: () => setManagerTarget(organization),
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
            href={`/admin/organizacoes/${row.original.id}`}
            className="hover:underline"
          >
            {row.original.name}
          </Link>
        ),
      }),
      columnHelper.accessor("taxId", {
        header: "CNPJ",
        enableSorting: false,
        // Roboto com algarismos tabulares (Figma 124:232), não fonte mono.
        meta: { cellVariant: "secondary", cellClassName: "tabular-nums" },
        cell: (info) =>
          info.getValue() ? formatCnpj(info.getValue()) : <EmptyValue />,
      }),
      columnHelper.accessor("type", {
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Tipo" disabled={loading} />
        ),
        meta: { cellVariant: "primary" },
        cell: (info) =>
          ORGANIZATION_TYPE_LABELS[info.getValue()] ?? <EmptyValue />,
        filterFn: (row, columnId, filterValue) =>
          !filterValue || row.getValue(columnId) === filterValue,
      }),
    ];

    const actionsColumn = columnHelper.display({
      id: "actions",
      header: "Ações",
      cell: ({ row }) => <DataTableRowActions actions={rowActions(row.original)} />,
    });

    // Mesmo boundary cast das outras listas: cada coluna tem um TValue
    // concreto e o `<DataTable>` recebe um único TValue para o array.
    return (canManage ? [...baseColumns, actionsColumn] : baseColumns) as ColumnDef<
      Organization,
      unknown
    >[];
  }, [canManage, loading, rowActions]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: organizations,
    columns,
    state: { sorting, columnFilters, globalFilter, pagination },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    globalFilterFn: organizationsGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  // Visão do TÉCNICO (Figma 135:898): Nome (link) + Comunidade/Organização
  // em texto de apoio, sem ordenação nem ações (a lista já vem ordenada).
  const producerColumns = useMemo(
    () =>
      [
        producerColumnHelper.display({
          id: "name",
          header: "Nome",
          meta: { cellVariant: "primary" },
          cell: ({ row }) => <ProducerNameLink producer={row.original} />,
        }),
        producerColumnHelper.display({
          id: "community",
          header: "Comunidade",
          meta: { cellVariant: "secondary" },
          cell: ({ row }) => row.original.community?.name || <EmptyValue />,
        }),
        producerColumnHelper.display({
          id: "organization",
          header: "Organização",
          meta: { cellVariant: "secondary" },
          cell: ({ row }) =>
            row.original.community?.organization?.name || <EmptyValue />,
        }),
      ] as ColumnDef<Producer, unknown>[],
    [],
  );

  const producersTable = useReactTable({
    data: sortedAssignedProducers,
    columns: producerColumns,
    state: { pagination: producersPagination },
    onPaginationChange: setProducersPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (producer) => producer.id,
  });

  function renderMobileCard(row: Row<Organization>) {
    const organization = row.original;
    return (
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Link
              href={`/admin/organizacoes/${organization.id}`}
              className="font-medium text-foreground hover:underline"
            >
              {organization.name}
            </Link>
            <p className="mt-1 text-sm text-muted-foreground tabular-nums">
              {formatCnpj(organization.taxId)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {ORGANIZATION_TYPE_LABELS[organization.type]}
            </p>
          </div>
          {canManage && (
            <DataTableRowActions
              align="end"
              className="shrink-0"
              actions={rowActions(organization)}
            />
          )}
        </div>
      </Card>
    );
  }

  function renderProducerMobileCard(row: Row<Producer>) {
    const producer = row.original;
    const community = producer.community;
    return (
      <Card className="p-4">
        <p className="font-medium text-foreground">
          <ProducerNameLink producer={producer} />
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {community?.name || <EmptyValue />}
          {" · "}
          {community?.organization?.name || <EmptyValue />}
        </p>
      </Card>
    );
  }

  if (!roleResolved) {
    // O papel vem do localStorage depois da montagem: até lá, só a
    // estrutura da página (nenhuma visão de papel é adiantada).
    return (
      <div className="flex flex-col gap-section-sm">
        <PageHeader title="Organizações" loading />
        <Skeleton aria-hidden="true" className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (currentRole === "MANAGER" || currentRole === "FARMER") {
    // Estado de passagem: o GESTOR vai para a própria organização e o
    // AGRICULTOR para os próprios planos. Só o erro fica na tela.
    const redirectDescription =
      currentRole === "MANAGER"
        ? "Abrindo a sua organização…"
        : "Abrindo os seus planos de produção…";

    return (
      <div className="flex flex-col gap-section-sm">
        <PageHeader
          title="Organizações"
          description={redirectError ? undefined : redirectDescription}
        />
        {redirectError ? (
          <InlineAlert
            variant="destructive"
            action={{ label: "Tentar novamente", onClick: () => resolveAndLoad() }}
          >
            {redirectError}
          </InlineAlert>
        ) : (
          <div aria-busy="true" className="flex flex-col gap-section-sm">
            <Skeleton aria-hidden="true" className="h-16 w-full rounded-xl" />
            <Skeleton aria-hidden="true" className="h-40 w-full rounded-xl" />
          </div>
        )}
      </div>
    );
  }

  if (currentRole === "TECHNICIAN") {
    return (
      <div className="flex flex-col gap-section-sm">
        <PageHeader
          title="Meus agricultores atendidos"
          description="Agricultores sob sua assistência técnica."
        />

        <DataTable
          table={producersTable}
          columns={producerColumns}
          isLoading={loading}
          hasError={Boolean(error)}
          onRetry={resolveAndLoad}
          errorHint={userFacingErrorHint(error)}
          emptyTitle="Nenhum agricultor atribuído a você ainda."
          emptyHint="Os agricultores aparecem aqui quando você é vinculado como técnico responsável por eles."
          renderMobileCard={renderProducerMobileCard}
        />

        {/* Como no Figma (135:898), sem paginação para listas curtas. Acima
            do menor tamanho de página, a lista passa a ser paginada (13.2). */}
        {!loading && !error && needsPagination(sortedAssignedProducers.length) ? (
          <DataTablePagination table={producersTable} />
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-section-sm">
      <PageHeader
        title="Organizações"
        description="Cooperativas e associações cadastradas na plataforma."
        actions={
          canManage ? (
            <Button type="button" size="lg" onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden="true" />
              Nova organização
            </Button>
          ) : undefined
        }
      />

      <DataTableToolbar
        table={table}
        searchPlaceholder="Buscar por nome ou CNPJ…"
        filters={[
          {
            columnId: "type",
            label: "Tipo",
            options: (
              Object.keys(ORGANIZATION_TYPE_LABELS) as OrganizationType[]
            ).map((type) => ({
              value: type,
              label: ORGANIZATION_TYPE_LABELS[type],
            })),
          },
        ]}
      />

      <DataTable
        table={table}
        columns={columns}
        isLoading={loading}
        hasError={Boolean(error)}
        onRetry={resolveAndLoad}
        errorHint={userFacingErrorHint(error)}
        hasActiveFilters={
          Boolean(table.getState().globalFilter) ||
          table.getState().columnFilters.length > 0
        }
        onClearFilters={() => {
          table.setGlobalFilter("");
          table.resetColumnFilters();
        }}
        emptyTitle="Nenhuma organização cadastrada ainda."
        emptyHint={
          canManage
            ? "Cadastre uma cooperativa ou associação informando nome, CNPJ e tipo."
            : "As organizações aparecem aqui quando um administrador as cadastra."
        }
        emptyActionLabel={canManage ? "Criar primeira organização" : undefined}
        onEmptyAction={canManage ? () => setCreateOpen(true) : undefined}
        renderMobileCard={renderMobileCard}
      />

      <DataTablePagination table={table} />

      {canManage && (
        <>
          <OrganizationFormDrawer
            mode="create"
            open={createOpen}
            onOpenChange={setCreateOpen}
            onSaved={resolveAndLoad}
          />

          <OrganizationFormDrawer
            mode="edit"
            organization={editTarget}
            open={editTarget !== null}
            onOpenChange={(open) => {
              if (!open) setEditTarget(null);
            }}
            onSaved={resolveAndLoad}
          />

          {managerTarget && (
            <ManagerRegisterDrawer
              organizationId={managerTarget.id}
              organizationName={managerTarget.name}
              open={managerTarget !== null}
              onOpenChange={(open) => {
                if (!open) setManagerTarget(null);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
