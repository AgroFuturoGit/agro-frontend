"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Pencil, Plus } from "lucide-react";

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

import { CommunityFormDialog } from "./community-form-dialog";

export function CommunitiesPage() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<Role | null>(null);
  const [roleResolved, setRoleResolved] = useState(false);
  // Organização do MANAGER logado, resolvida via GET /managers/me.
  // Também é o valor que a Task 03-02 passa para o CommunityFormDialog.
  const [myOrgId, setMyOrgId] = useState<string | null>(null);

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
      if (currentRole === "ADMIN") {
        // ADMIN não tem escopo: vê comunidades de todas as organizações.
        setCommunities(await listCommunities());
        return;
      }

      if (currentRole === "MANAGER") {
        // O backend não restringe o MANAGER à própria organização em
        // nenhuma operação de Comunidade (memória
        // `lesson-backend-hierarchy-ownership`, decisão D3). O filtro por
        // organização é obrigatório aqui e NUNCA pode virar uma listagem
        // sem filtro — nem como fallback de erro.
        let organizationId: string;
        try {
          organizationId = (await getMyManager()).organization.id;
        } catch (err) {
          setCommunities([]);
          setMyOrgId(null);
          setError(
            err instanceof ApiError
              ? `Não foi possível identificar a sua organização: ${err.message}`
              : "Não foi possível identificar a sua organização. Sem ela, as comunidades não podem ser listadas.",
          );
          return;
        }

        setMyOrgId(organizationId);
        setCommunities(await listCommunities(organizationId));
        return;
      }

      // Perfil desconhecido/não resolvido: não listamos nada sem escopo.
      setCommunities([]);
      setError(
        "Não foi possível identificar o seu perfil de acesso. Faça login novamente.",
      );
    } catch (err) {
      setCommunities([]);
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar as comunidades.",
      );
    } finally {
      setLoading(false);
    }
  }, [currentRole, roleResolved]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const sortedCommunities = useMemo(
    () =>
      [...communities].sort(
        (a, b) =>
          a.organization.name.localeCompare(b.organization.name) ||
          a.name.localeCompare(b.name),
      ),
    [communities],
  );

  const canManage = currentRole === "ADMIN" || currentRole === "MANAGER";
  // MANAGER sem organização resolvida não pode criar: a organização é
  // path param obrigatório e nunca pode ser escolhida por ele (D3).
  const canCreate =
    currentRole === "ADMIN" ||
    (currentRole === "MANAGER" && myOrgId !== null);
  const columnCount = canManage ? 3 : 2;

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Comunidades</h2>
          <p className="text-sm text-muted-foreground">
            {currentRole === "MANAGER"
              ? "Comunidades da sua organização."
              : "Comunidades cadastradas nas organizações."}
          </p>
        </div>
        {canCreate && (
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
              <TableHead>Organização</TableHead>
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
                  {currentRole === "MANAGER" && myOrgId
                    ? "Nenhuma comunidade cadastrada na sua organização ainda."
                    : "Nenhuma comunidade cadastrada ainda."}
                </TableCell>
              </TableRow>
            ) : (
              sortedCommunities.map((community) => (
                <TableRow key={community.id}>
                  <TableCell className="font-medium text-foreground">
                    {community.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {community.organization.name}
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
          // Só o MANAGER usa esta prop; o ADMIN escolhe no seletor.
          organizationId={currentRole === "MANAGER" ? myOrgId : null}
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
