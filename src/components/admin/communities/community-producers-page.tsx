"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Pencil, Plus, Trash2 } from "lucide-react";

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
import { getCommunity, type Community } from "@/lib/communities";
import { formatCpf } from "@/lib/cpf";
import { getMyManager } from "@/lib/managers";
import { listProducers, type Producer } from "@/lib/producers";

import { DeleteProducerDialog } from "../producers/delete-producer-dialog";
import { ProducerFormDialog } from "../producers/producer-form-dialog";
import { ProducerRegisterDialog } from "../producers/producer-register-dialog";

type Props = {
  communityId: string;
};

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
      // `GET /communities/{id}` é `hasRole('MANAGER') or hasRole('ADMIN')`
      // no backend (`CommunityController.java`) — TECHNICIAN/PRODUCER só
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
      // `GET /producers?communityId=` já escopa no backend — nenhum filtro
      // client-side adicional é necessário aqui (diferente da listagem
      // antiga sem escopo por rota).
      setProducers(await listProducers(communityId));
    } catch (err) {
      setCommunity(null);
      setProducers([]);
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar os produtores desta comunidade.",
      );
    } finally {
      setLoading(false);
    }
  }, [currentRole, roleResolved, communityId, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const sortedProducers = [...producers].sort((a, b) =>
    (a.user?.fullName ?? a.aliasName ?? "").localeCompare(
      b.user?.fullName ?? b.aliasName ?? "",
    ),
  );

  const canManage = currentRole === "ADMIN" || currentRole === "MANAGER";
  const colCount = canManage ? 5 : 4;
  const orgId = community?.organization.id;

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
            {community?.name ?? "Produtores"}
          </h2>
          <p className="text-sm text-muted-foreground">
            Produtores cadastrados nesta comunidade.
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
            Novo Produtor
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
              <TableHead>CPF</TableHead>
              <TableHead>Apelido</TableHead>
              <TableHead>Conformidade</TableHead>
              {canManage && (
                <TableHead className="w-[1%] text-right">Ações</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody className="[&_td]:h-12 [&_td]:px-4">
            {loading ? (
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
                  Nenhum produtor cadastrado nesta comunidade ainda.
                </TableCell>
              </TableRow>
            ) : (
              sortedProducers.map((producer) => (
                <TableRow key={producer.id}>
                  <TableCell className="font-medium text-foreground">
                    <Link
                      href={`/admin/organizacoes/${orgId}/comunidades/${communityId}/produtores/${producer.id}`}
                      className="hover:underline"
                    >
                      {producer.user?.fullName ?? producer.aliasName ?? "—"}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {producer.user?.cpf ? formatCpf(producer.user.cpf) : "—"}
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
          onCreated={refresh}
          communities={community ? [community] : []}
          loadingCommunities={community === null}
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
