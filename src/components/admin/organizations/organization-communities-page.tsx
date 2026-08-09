"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Pencil, Plus } from "lucide-react";

import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError } from "@/lib/api";
import { readUserFromStorage, type Role } from "@/lib/auth";
import { listCommunities, type Community } from "@/lib/communities";
import { getMyManager } from "@/lib/managers";
import { getOrganization, type Organization } from "@/lib/organizations";

import { CommunityFormDialog } from "../communities/community-form-dialog";

type Props = {
  orgId: string;
};

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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

      // ADMIN: caminho normal. TECHNICIAN/PRODUCER só chegam aqui por URL
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const sortedCommunities = [...communities].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const canManage = currentRole === "ADMIN" || currentRole === "MANAGER";
  const columnCount = canManage ? 2 : 1;

  function openCreateDialog() {
    setDialogMode("create");
    setDialogCommunity(null);
    setDialogOpen(true);
  }

  function openEditDialog(community: Community) {
    setDialogMode("edit");
    setDialogCommunity(community);
    setDialogOpen(true);
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
          { label: organization?.name ?? "Organização" },
        ]}
      />

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            {organization?.name ?? "Comunidades"}
          </h2>
          <p className="text-sm text-muted-foreground">
            Comunidades cadastradas nesta organização.
          </p>
        </div>
        {canManage && (
          <Button type="button" size="sm" onClick={openCreateDialog}>
            <Plus />
            Nova Comunidade
          </Button>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refresh()}
          >
            Tentar novamente
          </Button>
        </div>
      )}

      <Card className="py-0">
        <Table>
          <TableHeader className="bg-muted/40 [&_th]:h-11 [&_th]:px-4 [&_th]:text-xs [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground">
            <TableRow className="hover:bg-transparent">
              <TableHead>Nome</TableHead>
              {canManage && (
                <TableHead className="w-[1%] text-right">Ações</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody className="[&_td]:h-12 [&_td]:px-4">
            {loading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <TableRow key={`skeleton-${idx}`}>
                  {Array.from({ length: columnCount }).map((__, cidx) => (
                    <TableCell key={cidx}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : sortedCommunities.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columnCount}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  Nenhuma comunidade cadastrada nesta organização ainda.
                </TableCell>
              </TableRow>
            ) : (
              sortedCommunities.map((community) => (
                <TableRow key={community.id}>
                  <TableCell className="font-medium text-foreground">
                    <Link
                      href={`/admin/organizacoes/${orgId}/comunidades/${community.id}`}
                      className="hover:underline"
                    >
                      {community.name}
                    </Link>
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Editar comunidade"
                        onClick={() => openEditDialog(community)}
                      >
                        <Pencil />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {canManage && currentRole && (
        <CommunityFormDialog
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
