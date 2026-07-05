"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Pencil, Plus, Search, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useIsMobile } from "@/hooks/use-mobile";
import { ApiError } from "@/lib/api";
import { readUserFromStorage, type Role } from "@/lib/auth";
import {
  formatHarvestDate,
  listHarvests,
  type Harvest,
} from "@/lib/harvests";

import { DeleteHarvestDialog } from "./delete-harvest-dialog";
import { HarvestFormDialog } from "./harvest-form-dialog";

export function HarvestsPage() {
  const isMobile = useIsMobile();
  const [harvests, setHarvests] = useState<Harvest[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<Role | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Harvest | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Harvest | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentRole(readUserFromStorage()?.role ?? null);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim().toLowerCase());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const canManage =
    currentRole === "ADMIN" || currentRole === "TECHNICIAN";

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listHarvests();
      setHarvests(result);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar as safras.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const visibleHarvests = useMemo(() => {
    if (!search) return harvests;
    return harvests.filter((harvest) =>
      harvest.label.toLowerCase().includes(search),
    );
  }, [harvests, search]);

  const colCount = canManage ? 4 : 3;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Safras</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie as safras cadastradas no sistema.
          </p>
        </div>
        {canManage && (
          <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus />
            Nova safra
          </Button>
        )}
      </div>

      <div className="relative w-full sm:max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Buscar por rótulo…"
          className="pl-9"
          aria-label="Buscar por rótulo"
        />
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

      {isMobile ? (
        <div className="flex flex-col gap-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, idx) => (
              <Card key={`skeleton-${idx}`} className="p-4">
                <Skeleton className="mb-2 h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </Card>
            ))
          ) : visibleHarvests.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-sm text-muted-foreground">
                {search
                  ? "Nenhuma safra encontrada."
                  : "Nenhuma safra cadastrada."}
              </p>
              {canManage && !search && (
                <Button
                  type="button"
                  size="sm"
                  className="mt-4"
                  onClick={() => setCreateOpen(true)}
                >
                  Cadastrar primeira safra
                </Button>
              )}
            </Card>
          ) : (
            visibleHarvests.map((harvest) => (
              <Card key={harvest.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">
                      {harvest.label}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatHarvestDate(harvest.startDate)} —{" "}
                      {formatHarvestDate(harvest.endDate)}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label="Editar safra"
                        onClick={() => setEditTarget(harvest)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label="Excluir safra"
                        onClick={() => setDeleteTarget(harvest)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader className="bg-muted/40 [&_th]:h-11 [&_th]:px-4 [&_th]:text-xs [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground">
              <TableRow className="hover:bg-transparent">
                <TableHead>Rótulo</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Término</TableHead>
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
              ) : visibleHarvests.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={colCount} className="py-12 text-center">
                    <p className="text-sm text-muted-foreground">
                      {search
                        ? "Nenhuma safra encontrada."
                        : "Nenhuma safra cadastrada."}
                    </p>
                    {canManage && !search && (
                      <Button
                        type="button"
                        size="sm"
                        className="mt-4"
                        onClick={() => setCreateOpen(true)}
                      >
                        Cadastrar primeira safra
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                visibleHarvests.map((harvest) => (
                  <TableRow key={harvest.id}>
                    <TableCell className="font-medium text-foreground">
                      {harvest.label}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatHarvestDate(harvest.startDate)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatHarvestDate(harvest.endDate)}
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Editar safra"
                            onClick={() => setEditTarget(harvest)}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Excluir safra"
                            onClick={() => setDeleteTarget(harvest)}
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
      )}

      <HarvestFormDialog
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={refresh}
      />

      <HarvestFormDialog
        mode="edit"
        harvest={editTarget}
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        onSaved={refresh}
      />

      <DeleteHarvestDialog
        harvest={deleteTarget}
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onDeleted={refresh}
      />
    </div>
  );
}
