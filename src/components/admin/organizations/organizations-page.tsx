"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Pencil, Plus, UserPlus } from "lucide-react";

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
import { formatCnpj } from "@/lib/cnpj";
import { getMyManager } from "@/lib/managers";
import {
  listOrganizations,
  ORGANIZATION_TYPE_LABELS,
  type Organization,
} from "@/lib/organizations";
import { getMyProducer, type Producer } from "@/lib/producers";
import { getMyAssignedProducers } from "@/lib/technicians";

import { ManagerRegisterDialog } from "./manager-register-dialog";
import { OrganizationFormDialog } from "./organization-form-dialog";

/**
 * `/admin/organizacoes` é o único ponto de entrada da hierarquia
 * Organização → Comunidade → Produtor → Planos (ver plano `navegacao-
 * cascata-organizacoes`). ADMIN vê a lista completa e escolhe; MANAGER e
 * PRODUCER têm exatamente um recurso possível e são redirecionados
 * automaticamente para ele — nunca escolhem pela UI.
 *
 * TECHNICIAN não navega pela cascata institucional (sem vínculo fixo a uma
 * organização — ver `issues-fix-back.pdf` itens 7/8): fica na mesma URL,
 * mas em vez da lista de organizações, vê a lista de produtores atribuídos
 * a ele via `GET /technicians/me/producers` (relação N:N
 * `TechnicalAssistance`). Cada linha leva para a mesma rota de planos
 * usada pelas outras roles (`/admin/organizacoes/{orgId}/comunidades/
 * {communityId}/produtores/{producerId}`) — os links de organização/
 * comunidade no breadcrumb dessa página não funcionam para TECHNICIAN
 * (`GET /organizations/{id}` e `GET /communities/{id}` continuam
 * `ADMIN`/`MANAGER` apenas), mas a listagem de planos em si já tolera
 * isso (`producer-plans-page.tsx` cai em rótulos genéricos quando não
 * consegue resolver os nomes).
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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
        setRedirectError(
          err instanceof ApiError
            ? `Não foi possível identificar a sua organização: ${err.message}`
            : "Não foi possível identificar a sua organização.",
        );
      }
      return;
    }

    if (currentRole === "PRODUCER") {
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
        setRedirectError(
          err instanceof ApiError
            ? `Não foi possível identificar o seu produtor: ${err.message}`
            : "Não foi possível identificar o seu produtor.",
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
            : "Não foi possível carregar os produtores atendidos.",
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    resolveAndLoad();
  }, [resolveAndLoad]);

  const sortedOrganizations = useMemo(
    () => [...organizations].sort((a, b) => a.name.localeCompare(b.name)),
    [organizations],
  );

  const sortedAssignedProducers = useMemo(
    () =>
      [...assignedProducers].sort((a, b) =>
        (a.user?.fullName ?? a.aliasName ?? "").localeCompare(
          b.user?.fullName ?? b.aliasName ?? "",
        ),
      ),
    [assignedProducers],
  );

  // Escrita de Organização (criar/editar/criar Manager) é `hasRole('ADMIN')`
  // no backend real (`OrganizationController.java`) — TECHNICIAN só lê.
  const canManage = currentRole === "ADMIN";
  const columnCount = canManage ? 4 : 3;

  if (currentRole === "MANAGER" || currentRole === "PRODUCER") {
    if (redirectError) {
      return (
        <div className="flex flex-col gap-6">
          <div
            role="alert"
            className="flex items-start justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{redirectError}</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => resolveAndLoad()}
            >
              Tentar novamente
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (currentRole === "TECHNICIAN") {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Meus produtores atendidos
          </h2>
          <p className="text-sm text-muted-foreground">
            Produtores sob sua assistência técnica.
          </p>
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
              onClick={() => resolveAndLoad()}
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
                <TableHead>Comunidade</TableHead>
                <TableHead>Organização</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="[&_td]:h-12 [&_td]:px-4">
              {loading ? (
                Array.from({ length: 4 }).map((_, idx) => (
                  <TableRow key={`skeleton-${idx}`}>
                    {Array.from({ length: 3 }).map((__, cidx) => (
                      <TableCell key={cidx}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : sortedAssignedProducers.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={3}
                    className="py-12 text-center text-sm text-muted-foreground"
                  >
                    Nenhum produtor atribuído a você ainda.
                  </TableCell>
                </TableRow>
              ) : (
                sortedAssignedProducers.map((producer) => {
                  const community = producer.community;
                  const organization = community?.organization;
                  const name =
                    producer.user?.fullName ?? producer.aliasName ?? "—";

                  return (
                    <TableRow key={producer.id}>
                      <TableCell className="font-medium text-foreground">
                        {community && organization ? (
                          <Link
                            href={`/admin/organizacoes/${organization.id}/comunidades/${community.id}/produtores/${producer.id}`}
                            className="hover:underline"
                          >
                            {name}
                          </Link>
                        ) : (
                          name
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {community?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {organization?.name ?? "—"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Organizações
          </h2>
          <p className="text-sm text-muted-foreground">
            Cooperativas e associações cadastradas na plataforma.
          </p>
        </div>
        {canManage && (
          <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus />
            Nova Organização
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
            onClick={() => resolveAndLoad()}
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
              <TableHead>CNPJ</TableHead>
              <TableHead>Tipo</TableHead>
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
            ) : sortedOrganizations.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columnCount}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  Nenhuma organização cadastrada ainda.
                </TableCell>
              </TableRow>
            ) : (
              sortedOrganizations.map((organization) => (
                <TableRow key={organization.id}>
                  <TableCell className="font-medium text-foreground">
                    <Link
                      href={`/admin/organizacoes/${organization.id}`}
                      className="hover:underline"
                    >
                      {organization.name}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {formatCnpj(organization.taxId)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {ORGANIZATION_TYPE_LABELS[organization.type]}
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Editar organização"
                          onClick={() => setEditTarget(organization)}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Criar Manager"
                          onClick={() => setManagerTarget(organization)}
                        >
                          <UserPlus />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {canManage && (
        <>
          <OrganizationFormDialog
            mode="create"
            open={createOpen}
            onOpenChange={setCreateOpen}
            onSaved={resolveAndLoad}
          />

          <OrganizationFormDialog
            mode="edit"
            organization={editTarget}
            open={editTarget !== null}
            onOpenChange={(open) => {
              if (!open) setEditTarget(null);
            }}
            onSaved={resolveAndLoad}
          />

          {managerTarget && (
            <ManagerRegisterDialog
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
