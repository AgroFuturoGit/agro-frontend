"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, ShieldCheck } from "lucide-react";

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
import { listRoles, type BackendRole } from "@/lib/roles";
import { ROLE_LABELS } from "@/lib/users";

export function RolesPage() {
  const [roles, setRoles] = useState<BackendRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listRoles();
      setRoles(data);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar os perfis.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Perfis</h2>
        <p className="text-sm text-muted-foreground">
          Perfis disponíveis no sistema. A definição dos perfis é controlada
          pelo backend.
        </p>
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
              <TableHead>Perfil</TableHead>
              <TableHead>Identificador</TableHead>
              <TableHead>Descrição</TableHead>
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
            ) : roles.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={3}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  Nenhum perfil disponível.
                </TableCell>
              </TableRow>
            ) : (
              roles.map((role) => (
                <TableRow key={role.name}>
                  <TableCell className="font-medium text-foreground">
                    <span className="inline-flex items-center gap-2">
                      <ShieldCheck className="size-4 text-muted-foreground" />
                      {ROLE_LABELS[role.name] ?? role.name}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {role.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {role.description}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
