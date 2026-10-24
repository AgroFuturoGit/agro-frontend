"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type Row,
} from "@tanstack/react-table";
import { AlertCircle, Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable } from "@/components/data-table/data-table";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import {
  createFamilyMember,
  deleteFamilyMember,
  listFamilyMembers,
  parseSocialFieldErrors,
  updateFamilyMember,
  type FamilyMember,
} from "@/lib/farmer-social";

type Props = {
  farmerId: string;
  /** ADMIN, TECHNICIAN e FARMER escrevem; MANAGER e role desconhecida só leem. */
  canWrite: boolean;
};

type FormValues = { name: string; kinship: string; age: string };

const EMPTY: FormValues = { name: "", kinship: "", age: "" };
const MAX_KINSHIP = 100;
const MAX_NAME = 255;

function validate(values: FormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values.name.trim()) errors.name = "O nome é obrigatório";
  else if (values.name.trim().length > MAX_NAME)
    errors.name = `O nome deve ter no máximo ${MAX_NAME} caracteres`;
  if (!values.kinship.trim()) errors.kinship = "O parentesco é obrigatório";
  else if (values.kinship.trim().length > MAX_KINSHIP)
    errors.kinship = `O parentesco deve ter no máximo ${MAX_KINSHIP} caracteres`;
  if (values.age.trim() === "") errors.age = "A idade é obrigatória";
  else if (!/^\d+$/.test(values.age.trim()))
    errors.age = "A idade deve ser um número inteiro, sem negativos";
  return errors;
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function FamilyCompositionSection({ farmerId, canWrite }: Props) {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<FamilyMember | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FamilyMember | null>(null);

  const [values, setValues] = useState<FormValues>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setMembers(await listFamilyMembers(farmerId));
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar a composição familiar.",
      );
    } finally {
      setLoading(false);
    }
  }, [farmerId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function openCreate() {
    setEditTarget(null);
    setValues(EMPTY);
    setFieldErrors({});
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(member: FamilyMember) {
    setEditTarget(member);
    setValues({
      name: member.name,
      kinship: member.kinship,
      age: String(member.age),
    });
    setFieldErrors({});
    setFormError(null);
    setFormOpen(true);
  }

  function update(field: keyof FormValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const errors = validate(values);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const payload = {
      name: values.name.trim(),
      kinship: values.kinship.trim(),
      age: Number(values.age.trim()),
    };
    setSubmitting(true);
    try {
      if (editTarget) await updateFamilyMember(editTarget.id, payload);
      else await createFamilyMember(farmerId, payload);
      setFormOpen(false);
      await refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        const fromApi = err.status === 400 ? parseSocialFieldErrors(err.payload) : {};
        if (Object.keys(fromApi).length > 0) {
          setFieldErrors(fromApi);
        } else {
          setFormError(err.message);
        }
      } else {
        setFormError("Não foi possível salvar o membro familiar.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      await deleteFamilyMember(deleteTarget.id);
      setDeleteTarget(null);
      await refresh();
    } catch (err) {
      setDeleteError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível excluir o membro familiar.",
      );
    } finally {
      setDeleting(false);
    }
  }

  function actions(member: FamilyMember, compact: boolean) {
    if (!canWrite) return null;
    return (
      <div className="inline-flex items-center gap-1">
        <Button
          type="button"
          variant={compact ? "outline" : "ghost"}
          size={compact ? "sm" : "icon-sm"}
          aria-label={`Editar ${member.name}`}
          onClick={() => openEdit(member)}
        >
          <Pencil />
          {compact && "Editar"}
        </Button>
        <Button
          type="button"
          variant={compact ? "outline" : "ghost"}
          size="icon-sm"
          aria-label={`Excluir ${member.name}`}
          onClick={() => {
            setDeleteError(null);
            setDeleteTarget(member);
          }}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 />
        </Button>
      </div>
    );
  }

  const columns: ColumnDef<FamilyMember>[] = [
    {
      accessorKey: "name",
      header: "Nome",
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: "kinship",
      header: "Parentesco",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.kinship}</span>
      ),
    },
    {
      accessorKey: "age",
      header: () => <div className="text-right">Idade</div>,
      cell: ({ row }) => (
        <div className="text-right tabular-nums">{row.original.age}</div>
      ),
    },
    ...(canWrite
      ? [
          {
            id: "actions",
            header: "Ações",
            cell: ({ row }: { row: Row<FamilyMember> }) =>
              actions(row.original, false),
          } satisfies ColumnDef<FamilyMember>,
        ]
      : []),
  ];

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: members,
    columns,
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  function renderMobileCard(row: Row<FamilyMember>) {
    const member = row.original;
    return (
      <Card key={member.id} className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium">{member.name}</p>
            <p className="text-sm text-muted-foreground">
              {member.kinship} · {member.age} {member.age === 1 ? "ano" : "anos"}
            </p>
          </div>
          {actions(member, true)}
        </div>
      </Card>
    );
  }

  function renderBody() {
    if (loading) return <Skeleton className="h-24 w-full rounded-xl" />;
    if (error) {
      return (
        <div
          role="alert"
          className="flex items-start justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={refresh}>
            Tentar novamente
          </Button>
        </div>
      );
    }
    if (members.length === 0) {
      return (
        <p className="rounded-lg border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          Nenhum membro familiar cadastrado
        </p>
      );
    }
    return (
      <>
        <DataTable
          table={table}
          columns={columns}
          renderMobileCard={renderMobileCard}
        />
        <DataTablePagination table={table} />
      </>
    );
  }

  const showCount = !loading && !error;

  return (
    <section aria-labelledby="family-composition-title" className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h3
            id="family-composition-title"
            className="text-lg font-semibold tracking-tight"
          >
            Composição familiar
            {showCount && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({members.length} {members.length === 1 ? "membro" : "membros"})
              </span>
            )}
          </h3>
        </div>
        {canWrite && (
          <Button type="button" size="sm" variant="outline" onClick={openCreate}>
            <Plus />
            Adicionar membro
          </Button>
        )}
      </div>

      {renderBody()}

      {canWrite && (
        <>
          <Dialog open={formOpen} onOpenChange={(open) => !submitting && setFormOpen(open)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editTarget ? "Editar membro familiar" : "Novo membro familiar"}
                </DialogTitle>
                <DialogDescription>
                  Informe nome, parentesco com o agricultor e idade.
                </DialogDescription>
              </DialogHeader>
              <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div aria-live="polite">
                  {formError && <ErrorBox message={formError} />}
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="family-name">Nome</Label>
                  <Input
                    id="family-name"
                    value={values.name}
                    onChange={(e) => update("name", e.target.value)}
                    disabled={submitting}
                    aria-invalid={Boolean(fieldErrors.name)}
                  />
                  {fieldErrors.name && (
                    <p className="text-sm text-destructive">{fieldErrors.name}</p>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="family-kinship">Parentesco</Label>
                  <Input
                    id="family-kinship"
                    value={values.kinship}
                    onChange={(e) => update("kinship", e.target.value)}
                    disabled={submitting}
                    placeholder="Ex.: Esposa, Filho"
                    aria-invalid={Boolean(fieldErrors.kinship)}
                  />
                  {fieldErrors.kinship && (
                    <p className="text-sm text-destructive">{fieldErrors.kinship}</p>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="family-age">Idade</Label>
                  <Input
                    id="family-age"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="1"
                    value={values.age}
                    onChange={(e) => update("age", e.target.value)}
                    disabled={submitting}
                    aria-invalid={Boolean(fieldErrors.age)}
                  />
                  {fieldErrors.age && (
                    <p className="text-sm text-destructive">{fieldErrors.age}</p>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setFormOpen(false)}
                    disabled={submitting}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="animate-spin" />
                        Salvando…
                      </>
                    ) : (
                      "Salvar"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <AlertDialog
            open={deleteTarget !== null}
            onOpenChange={(open) => {
              if (!open && !deleting) setDeleteTarget(null);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir membro familiar</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação removerá{" "}
                  <span className="font-medium text-foreground">
                    {deleteTarget?.name}
                  </span>{" "}
                  da composição familiar. Não é possível desfazer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              {deleteError && <ErrorBox message={deleteError} />}
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Excluindo…
                    </>
                  ) : (
                    "Excluir"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </section>
  );
}
