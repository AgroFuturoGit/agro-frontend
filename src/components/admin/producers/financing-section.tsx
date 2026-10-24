"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
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
import {
  FINANCING_STATUSES,
  FINANCING_STATUS_LABELS,
  createFinancing,
  deleteFinancing,
  formatCurrency,
  listFinancings,
  parseAmountInput,
  parseSocialFieldErrors,
  updateFinancing,
  type Financing,
  type FinancingStatus,
} from "@/lib/farmer-social";

type Props = {
  farmerId: string;
  /** ADMIN, TECHNICIAN e FARMER escrevem; MANAGER e role desconhecida só leem. */
  canWrite: boolean;
};

type FormValues = { description: string; status: string; amount: string };

const EMPTY: FormValues = { description: "", status: "", amount: "" };
const MAX_DESCRIPTION = 255;

const STATUS_STYLES: Record<FinancingStatus, string> = {
  PENDING: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  IN_ANALYSIS: "bg-sky-500/15 text-sky-800 dark:text-sky-300",
  APPROVED: "bg-primary/10 text-primary",
  REJECTED: "bg-destructive/10 text-destructive",
  CANCELED: "bg-muted text-muted-foreground",
  PAID: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
};

function validate(values: FormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values.description.trim()) errors.description = "A descrição é obrigatória";
  else if (values.description.trim().length > MAX_DESCRIPTION)
    errors.description = `A descrição deve ter no máximo ${MAX_DESCRIPTION} caracteres`;
  if (!values.status) errors.status = "A situação é obrigatória";
  if (!values.amount.trim()) errors.amount = "O valor é obrigatório";
  else {
    const amount = parseAmountInput(values.amount);
    if (amount === null || amount < 0.01)
      errors.amount = "O valor deve ser maior que zero";
  }
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

function StatusBadge({ status }: { status: FinancingStatus | null }) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  return (
    <span
      data-status={status}
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {FINANCING_STATUS_LABELS[status]}
    </span>
  );
}

/** Valor para o campo de texto na edição: vírgula decimal, sem milhar. */
function amountToInput(amount: number): string {
  return String(amount).replace(".", ",");
}

export function FinancingSection({ farmerId, canWrite }: Props) {
  const isMobile = useIsMobile();
  const [items, setItems] = useState<Financing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Financing | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Financing | null>(null);

  const [values, setValues] = useState<FormValues>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await listFinancings(farmerId));
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar os financiamentos.",
      );
    } finally {
      setLoading(false);
    }
  }, [farmerId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  function openCreate() {
    setEditTarget(null);
    setValues(EMPTY);
    setFieldErrors({});
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(item: Financing) {
    setEditTarget(item);
    setValues({
      description: item.description,
      status: item.status ?? "",
      amount: amountToInput(item.amount),
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
      description: values.description.trim(),
      status: values.status as FinancingStatus,
      amount: parseAmountInput(values.amount) as number,
    };
    setSubmitting(true);
    try {
      if (editTarget) await updateFinancing(editTarget.id, payload);
      else await createFinancing(farmerId, payload);
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
        setFormError("Não foi possível salvar o financiamento.");
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
      await deleteFinancing(deleteTarget.id);
      setDeleteTarget(null);
      await refresh();
    } catch (err) {
      setDeleteError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível excluir o financiamento.",
      );
    } finally {
      setDeleting(false);
    }
  }

  function actions(item: Financing, compact: boolean) {
    if (!canWrite) return null;
    return (
      <div className="inline-flex items-center gap-1">
        <Button
          type="button"
          variant={compact ? "outline" : "ghost"}
          size={compact ? "sm" : "icon-sm"}
          aria-label={`Editar ${item.description}`}
          onClick={() => openEdit(item)}
        >
          <Pencil />
          {compact && "Editar"}
        </Button>
        <Button
          type="button"
          variant={compact ? "outline" : "ghost"}
          size="icon-sm"
          aria-label={`Excluir ${item.description}`}
          onClick={() => {
            setDeleteError(null);
            setDeleteTarget(item);
          }}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 />
        </Button>
      </div>
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
    if (items.length === 0) {
      return (
        <p className="rounded-lg border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          Nenhum financiamento cadastrado
        </p>
      );
    }
    if (isMobile) {
      return (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <Card key={item.id} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{item.description}</p>
                  <p className="mt-1 text-sm tabular-nums text-muted-foreground">
                    {formatCurrency(item.amount)}
                  </p>
                  <div className="mt-1">
                    <StatusBadge status={item.status} />
                  </div>
                </div>
                {actions(item, true)}
              </div>
            </Card>
          ))}
        </div>
      );
    }
    return (
      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descrição</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              {canWrite && <TableHead>Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.description}</TableCell>
                <TableCell>
                  <StatusBadge status={item.status} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(item.amount)}
                </TableCell>
                {canWrite && <TableCell>{actions(item, false)}</TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  // Rejeitados e cancelados não são dinheiro financiado.
  const total = items
    .filter((item) => item.status !== "REJECTED" && item.status !== "CANCELED")
    .reduce((sum, item) => sum + item.amount, 0);
  const showTotal = !loading && !error && items.length > 0;

  return (
    <section aria-labelledby="financing-title" className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <h3 id="financing-title" className="text-lg font-semibold tracking-tight">
          Financiamentos
          {showTotal && (
            <span
              data-testid="financing-total"
              className="ml-2 text-sm font-normal text-muted-foreground"
            >
              Total financiado: {formatCurrency(total)}
            </span>
          )}
        </h3>
        {canWrite && (
          <Button type="button" size="sm" variant="outline" onClick={openCreate}>
            <Plus />
            Adicionar financiamento
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
                  {editTarget ? "Editar financiamento" : "Novo financiamento"}
                </DialogTitle>
                <DialogDescription>
                  Informe a descrição, a situação e o valor financiado em reais.
                </DialogDescription>
              </DialogHeader>
              <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div aria-live="polite">
                  {formError && <ErrorBox message={formError} />}
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="financing-description">Descrição</Label>
                  <Input
                    id="financing-description"
                    value={values.description}
                    onChange={(e) => update("description", e.target.value)}
                    disabled={submitting}
                    placeholder="Ex.: PRONAF Custeio 2026"
                    aria-invalid={Boolean(fieldErrors.description)}
                  />
                  {fieldErrors.description && (
                    <p className="text-sm text-destructive">{fieldErrors.description}</p>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="financing-status">Situação</Label>
                  <select
                    id="financing-status"
                    value={values.status}
                    onChange={(e) => update("status", e.target.value)}
                    disabled={submitting}
                    aria-invalid={Boolean(fieldErrors.status)}
                    className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 aria-invalid:border-destructive md:text-sm dark:bg-input/30"
                  >
                    <option value="">Selecione…</option>
                    {FINANCING_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {FINANCING_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.status && (
                    <p className="text-sm text-destructive">{fieldErrors.status}</p>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="financing-amount">Valor (R$)</Label>
                  <Input
                    id="financing-amount"
                    inputMode="decimal"
                    value={values.amount}
                    onChange={(e) => update("amount", e.target.value)}
                    disabled={submitting}
                    placeholder="Ex.: 25.000,00"
                    aria-invalid={Boolean(fieldErrors.amount)}
                  />
                  {fieldErrors.amount && (
                    <p className="text-sm text-destructive">{fieldErrors.amount}</p>
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
                <AlertDialogTitle>Excluir financiamento</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação removerá o financiamento{" "}
                  <span className="font-medium text-foreground">
                    {deleteTarget?.description}
                  </span>
                  . Não é possível desfazer.
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
