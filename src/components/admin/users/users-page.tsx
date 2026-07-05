"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Pencil, Plus, Trash2 } from "lucide-react";

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
import { formatCpf } from "@/lib/cpf";
import { listUsers, ROLE_LABELS, type User } from "@/lib/users";

import { DeleteUserDialog } from "./delete-user-dialog";
import { UserFormDialog } from "./user-form-dialog";

function formatDate(value: string | null): string {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<Role | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentRole(readUserFromStorage()?.role ?? null);
  }, []);

  const canManage = currentRole === "ADMIN";

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listUsers();
      setUsers(data);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar os usuários.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [users],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Usuários</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie os usuários do sistema.
          </p>
        </div>
        {canManage && (
          <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus />
            Novo usuário
          </Button>
        )}
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
              <TableHead>E-mail</TableHead>
              <TableHead>CPF</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Nascimento</TableHead>
              {canManage && (
                <TableHead className="w-[1%] text-right">Ações</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody className="[&_td]:h-12 [&_td]:px-4">
            {loading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <TableRow key={`skeleton-${idx}`}>
                  {Array.from({ length: canManage ? 6 : 5 }).map((__, cidx) => (
                    <TableCell key={cidx}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : sortedUsers.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={canManage ? 6 : 5}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  Nenhum usuário cadastrado ainda.
                </TableCell>
              </TableRow>
            ) : (
              sortedUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium text-foreground">
                    {user.fullName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.email}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {formatCpf(user.cpf)}
                  </TableCell>
                  <TableCell>{ROLE_LABELS[user.role] ?? user.role}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(user.dateOfBirth)}
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Editar usuário"
                          onClick={() => setEditTarget(user)}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Excluir usuário"
                          onClick={() => setDeleteTarget(user)}
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

      <UserFormDialog
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={refresh}
      />

      <UserFormDialog
        mode="edit"
        user={editTarget}
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        onSaved={refresh}
      />

      <DeleteUserDialog
        user={deleteTarget}
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onDeleted={refresh}
      />
    </div>
  );
}
