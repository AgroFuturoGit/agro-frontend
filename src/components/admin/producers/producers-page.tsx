"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Pencil, Plus, Trash2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { formatCpf } from "@/lib/cpf";
import { getMyManager } from "@/lib/managers";
import { listProducers, type Producer } from "@/lib/producers";

import { DeleteProducerDialog } from "./delete-producer-dialog";
import { ProducerFormDialog } from "./producer-form-dialog";
import { ProducerRegisterDialog } from "./producer-register-dialog";

/**
 * Valor sentinela do filtro. UUID nunca colide com "all", e o `Select` do
 * `@base-ui/react` precisa de um valor não vazio para exibir a opção
 * selecionada.
 */
const ALL_COMMUNITIES = "all";

export function ProducersPage() {
  const [producers, setProducers] = useState<Producer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<Role | null>(null);
  const [roleResolved, setRoleResolved] = useState(false);

  // Organização do MANAGER logado, resolvida UMA ÚNICA VEZ via
  // GET /managers/me (RN1). Nem o diálogo de cadastro nem o filtro
  // resolvem a organização por conta própria.
  const [myOrganizationId, setMyOrganizationId] = useState<string | null>(null);
  // Uma única chamada de comunidades alimenta o diálogo de cadastro E o
  // filtro de listagem.
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loadingCommunities, setLoadingCommunities] = useState(true);
  const [communitiesError, setCommunitiesError] = useState<string | null>(null);

  const [communityFilter, setCommunityFilter] =
    useState<string>(ALL_COMMUNITIES);

  const [registerOpen, setRegisterOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Producer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Producer | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentRole(readUserFromStorage()?.role ?? null);
    setRoleResolved(true);
  }, []);

  const canManage = currentRole === "ADMIN" || currentRole === "MANAGER";

  // Resolve o escopo da página: organização do MANAGER + comunidades
  // visíveis. Só ADMIN e MANAGER têm acesso a GET /communities; TECHNICIAN
  // segue vendo todos os produtores, sem escopo (RN3).
  const loadScope = useCallback(async () => {
    if (!roleResolved) return;

    if (currentRole !== "ADMIN" && currentRole !== "MANAGER") {
      setCommunities([]);
      setLoadingCommunities(false);
      return;
    }

    setLoadingCommunities(true);
    setCommunitiesError(null);
    try {
      let organizationId: string | null = null;
      if (currentRole === "MANAGER") {
        organizationId = (await getMyManager()).organization.id;
        setMyOrganizationId(organizationId);
      }
      setCommunities(
        organizationId
          ? await listCommunities(organizationId)
          : await listCommunities(),
      );
    } catch (err) {
      setMyOrganizationId(null);
      setCommunities([]);
      setCommunitiesError(
        err instanceof ApiError
          ? `Não foi possível carregar as comunidades: ${err.message}`
          : "Não foi possível carregar as comunidades.",
      );
    } finally {
      setLoadingCommunities(false);
    }
  }, [currentRole, roleResolved]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadScope();
  }, [loadScope]);

  const refresh = useCallback(async () => {
    if (!roleResolved) return;

    setLoading(true);
    setError(null);
    try {
      const data =
        communityFilter === ALL_COMMUNITIES
          ? await listProducers()
          : await listProducers(communityFilter);
      setProducers(data);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar os produtores.",
      );
    } finally {
      setLoading(false);
    }
  }, [communityFilter, roleResolved]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  // Escopo client-side do MANAGER (RN2/D3): GET /producers só aceita
  // `?communityId=`, então "todas as comunidades" traz produtores de todas
  // as organizações e a UI descarta o que está fora das comunidades da
  // organização do usuário.
  //
  // ⚠️ ISTO É BARREIRA DE UX, NÃO DE SEGURANÇA. O backend continua
  // respondendo a chamada direta sem escopo, e o dado de outras
  // organizações trafega até o navegador — some apenas na renderização.
  // Enquanto as comunidades não forem conhecidas, o conjunto permitido é
  // vazio: nunca cair em listagem sem filtro, nem como fallback de erro.
  const scopedProducers = useMemo(() => {
    if (currentRole !== "MANAGER") return producers;
    const allowedCommunityIds = new Set(communities.map((item) => item.id));
    return producers.filter(
      (producer) =>
        producer.community != null &&
        allowedCommunityIds.has(producer.community.id),
    );
  }, [producers, communities, currentRole]);

  const sortedProducers = useMemo(
    () =>
      [...scopedProducers].sort((a, b) =>
        (a.user?.fullName ?? a.aliasName ?? "").localeCompare(
          b.user?.fullName ?? b.aliasName ?? "",
        ),
      ),
    [scopedProducers],
  );

  const colCount = canManage ? 6 : 5;
  // Sem as comunidades resolvidas o MANAGER não tem escopo: a listagem
  // continua em skeleton em vez de piscar uma lista que ainda vai ser
  // filtrada.
  const showSkeleton =
    loading || (currentRole === "MANAGER" && loadingCommunities);
  // Sem comunidades carregadas — ou, para o MANAGER, sem a organização
  // resolvida — não há como filtrar nem cadastrar com escopo.
  const scopeUnavailable =
    loadingCommunities ||
    communitiesError !== null ||
    (currentRole === "MANAGER" && myOrganizationId === null);

  function selectedCommunityLabel(value: string | null): string {
    if (!value || value === ALL_COMMUNITIES) return "Todas as comunidades";
    return (
      communities.find((item) => item.id === value)?.name ??
      "Todas as comunidades"
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Produtores</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie os produtores cadastrados nas comunidades.
          </p>
        </div>
        {canManage && (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex w-full flex-col gap-2 sm:w-64">
              <Label htmlFor="producers-community-filter">Comunidade</Label>
              <Select
                value={communityFilter}
                onValueChange={(value) =>
                  setCommunityFilter(value ?? ALL_COMMUNITIES)
                }
                disabled={scopeUnavailable}
              >
                <SelectTrigger
                  id="producers-community-filter"
                  className="w-full"
                >
                  <SelectValue placeholder="Todas as comunidades">
                    {(value) => selectedCommunityLabel(value)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_COMMUNITIES}>
                    Todas as comunidades
                  </SelectItem>
                  {communities.map((community) => (
                    <SelectItem key={community.id} value={community.id}>
                      {community.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => setRegisterOpen(true)}
              disabled={scopeUnavailable}
            >
              <Plus />
              Novo Produtor
            </Button>
          </div>
        )}
      </div>

      {communitiesError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{communitiesError}</span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Card className="py-0">
        <Table>
          <TableHeader className="bg-muted/40 [&_th]:h-11 [&_th]:px-4 [&_th]:text-xs [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground">
            <TableRow className="hover:bg-transparent">
              <TableHead>Nome</TableHead>
              <TableHead>CPF</TableHead>
              <TableHead>Comunidade</TableHead>
              <TableHead>Apelido</TableHead>
              <TableHead>Conformidade</TableHead>
              {canManage && (
                <TableHead className="w-[1%] text-right">Ações</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody className="[&_td]:h-12 [&_td]:px-4">
            {showSkeleton ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <TableRow key={`skeleton-${idx}`}>
                  {Array.from({ length: colCount }).map((__, cidx) => (
                    <TableCell key={cidx}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : sortedProducers.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={colCount}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  Nenhum produtor cadastrado ainda.
                </TableCell>
              </TableRow>
            ) : (
              sortedProducers.map((producer) => (
                <TableRow key={producer.id}>
                  <TableCell className="font-medium text-foreground">
                    {producer.user?.fullName ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {producer.user?.cpf ? formatCpf(producer.user.cpf) : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {producer.community?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {producer.aliasName ?? "—"}
                  </TableCell>
                  <TableCell>
                    {producer.isCompliant == null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : producer.isCompliant ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        Em conformidade
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                        Pendente
                      </span>
                    )}
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Editar produtor"
                          onClick={() => setEditTarget(producer)}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Excluir produtor"
                          onClick={() => setDeleteTarget(producer)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 />
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
        <ProducerRegisterDialog
          open={registerOpen}
          onOpenChange={setRegisterOpen}
          // O diálogo continua aberto no painel de confirmação depois do
          // sucesso: a listagem é recarregada por baixo dele.
          onCreated={refresh}
          communities={communities}
          loadingCommunities={loadingCommunities}
        />
      )}

      <ProducerFormDialog
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
