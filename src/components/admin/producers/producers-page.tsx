"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Pencil, Trash2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { formatCpf } from "@/lib/cpf";
import { listProducers, type Producer } from "@/lib/producers";

import { DeleteProducerDialog } from "./delete-producer-dialog";
import { ProducerFormDialog } from "./producer-form-dialog";

export function ProducersPage() {
  const [producers, setProducers] = useState<Producer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<Role | null>(null);

  const [editTarget, setEditTarget] = useState<Producer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Producer | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentRole(readUserFromStorage()?.role ?? null);
  }, []);

  const canManage = currentRole === "ADMIN" || currentRole === "MANAGER";

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listProducers();
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
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const sortedProducers = useMemo(
    () =>
      [...producers].sort((a, b) =>
        (a.user?.fullName ?? a.aliasName ?? "").localeCompare(
          b.user?.fullName ?? b.aliasName ?? "",
        ),
      ),
    [producers],
  );

  const colCount = canManage ? 6 : 5;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Produtores</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie os produtores cadastrados nas comunidades.
          </p>
        </div>
      </div>

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
