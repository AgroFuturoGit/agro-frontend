"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Pencil, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { listCrops, type Crop } from "@/lib/crops";

import { CropFormDialog } from "./crop-form-dialog";
import { PriorityBadge } from "./priority-badge";

const PAGE_SIZE = 20;

export function CropsPage() {
  const isMobile = useIsMobile();
  const [crops, setCrops] = useState<Crop[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [onlyPriority, setOnlyPriority] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<Role | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Crop | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentRole(readUserFromStorage()?.role ?? null);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const canManage =
    currentRole === "ADMIN" || currentRole === "TECHNICIAN";

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listCrops({
        search: search || undefined,
        isPriority: onlyPriority || undefined,
        page,
        limit: PAGE_SIZE,
      });
      setCrops(result.data);
      setTotalPages(Math.max(1, result.meta.totalPages));
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar as culturas.",
      );
    } finally {
      setLoading(false);
    }
  }, [search, onlyPriority, page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  function handlePriorityFilterChange(checked: boolean) {
    setOnlyPriority(checked);
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Culturas Agrícolas
          </h2>
          <p className="text-sm text-muted-foreground">
            Gerencie as culturas cadastradas no sistema.
          </p>
        </div>
        {canManage && (
          <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus />
            Nova cultura
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por nome ou variedade…"
            className="pl-9"
            aria-label="Buscar por nome ou variedade"
          />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="only-priority"
            checked={onlyPriority}
            onCheckedChange={(checked) =>
              handlePriorityFilterChange(checked === true)
            }
          />
          <Label htmlFor="only-priority" className="font-normal">
            Somente prioritárias
          </Label>
        </div>
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
                <Skeleton className="h-4 w-1/3" />
              </Card>
            ))
          ) : crops.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhuma cultura cadastrada.
              </p>
              {canManage && (
                <Button
                  type="button"
                  size="sm"
                  className="mt-4"
                  onClick={() => setCreateOpen(true)}
                >
                  Cadastrar primeira cultura
                </Button>
              )}
            </Card>
          ) : (
            crops.map((crop) => (
              <Card key={crop.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">
                      {crop.name} — {crop.variety}
                    </p>
                    <div className="mt-2">
                      <PriorityBadge isPriority={crop.isPriority} />
                    </div>
                  </div>
                  {canManage && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditTarget(crop)}
                    >
                      <Pencil />
                      Editar
                    </Button>
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
                <TableHead>Nome</TableHead>
                <TableHead>Variedade</TableHead>
                <TableHead>Prioritária</TableHead>
                {canManage && (
                  <TableHead className="w-[1%] text-right">Ações</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody className="[&_td]:h-12 [&_td]:px-4">
              {loading ? (
                Array.from({ length: 4 }).map((_, idx) => (
                  <TableRow key={`skeleton-${idx}`}>
                    {Array.from({ length: canManage ? 4 : 3 }).map(
                      (__, cidx) => (
                        <TableCell key={cidx}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ),
                    )}
                  </TableRow>
                ))
              ) : crops.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={canManage ? 4 : 3}
                    className="py-12 text-center"
                  >
                    <p className="text-sm text-muted-foreground">
                      Nenhuma cultura cadastrada.
                    </p>
                    {canManage && (
                      <Button
                        type="button"
                        size="sm"
                        className="mt-4"
                        onClick={() => setCreateOpen(true)}
                      >
                        Cadastrar primeira cultura
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                crops.map((crop) => (
                  <TableRow key={crop.id}>
                    <TableCell className="font-medium text-foreground">
                      {crop.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {crop.variety}
                    </TableCell>
                    <TableCell>
                      <PriorityBadge isPriority={crop.isPriority} />
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Editar cultura"
                          onClick={() => setEditTarget(crop)}
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
      )}

      {!loading && crops.length > 0 && (
        <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Anterior
          </Button>
          <span>
            Página {page} de {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() =>
              setPage((current) => Math.min(totalPages, current + 1))
            }
          >
            Próximo
          </Button>
        </div>
      )}

      <CropFormDialog
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={refresh}
      />

      <CropFormDialog
        mode="edit"
        crop={editTarget}
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        onSaved={refresh}
      />
    </div>
  );
}
