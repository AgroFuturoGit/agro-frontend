"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AlertCircle, ExternalLink, Loader2, Pencil, Plus, Trash2 } from "lucide-react";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import {
  OCCURRENCE_TYPES,
  OCCURRENCE_TYPE_LABELS,
  createOccurrence,
  deleteOccurrence,
  isSafeEvidenceUrl,
  listOccurrences,
  parseOccurrenceFieldErrors,
  updateOccurrence,
  type FieldOccurrence,
  type OccurrenceType,
} from "@/lib/occurrences";
import { formatPlanDate, type ProductionExecution } from "@/lib/production";

type Props = {
  execution: ProductionExecution | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** ADMIN, TECHNICIAN e FARMER escrevem; MANAGER e role desconhecida só leem. */
  canWrite: boolean;
};

type FormValues = {
  logType: string;
  description: string;
  weatherObservation: string;
  evidenceUrl: string;
};

const EMPTY: FormValues = {
  logType: "",
  description: "",
  weatherObservation: "",
  evidenceUrl: "",
};
const MAX_WEATHER = 255;
const MAX_URL = 500;

const TYPE_STYLES: Record<OccurrenceType, string> = {
  CLIMATE: "bg-sky-500/15 text-sky-800 dark:text-sky-300",
  PEST: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  DISEASE: "bg-destructive/10 text-destructive",
};

function validate(values: FormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values.logType) errors.logType = "O tipo de ocorrência é obrigatório";
  if (!values.description.trim()) errors.description = "A descrição é obrigatória";
  if (values.weatherObservation.trim().length > MAX_WEATHER)
    errors.weatherObservation = `A observação deve ter no máximo ${MAX_WEATHER} caracteres`;
  const url = values.evidenceUrl.trim();
  if (url) {
    if (url.length > MAX_URL)
      errors.evidenceUrl = `O link deve ter no máximo ${MAX_URL} caracteres`;
    else if (!isSafeEvidenceUrl(url))
      errors.evidenceUrl = "Informe um link http:// ou https:// válido";
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

/**
 * Ocorrências de campo (clima, praga, doença) de um apontamento. A lista e o
 * formulário vivem no mesmo painel; a exclusão pede confirmação à parte.
 */
export function ExecutionOccurrencesSheet({
  execution,
  open,
  onOpenChange,
  canWrite,
}: Props) {
  const executionId = execution?.id ?? null;

  const [items, setItems] = useState<FieldOccurrence[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formVisible, setFormVisible] = useState(false);
  const [editTarget, setEditTarget] = useState<FieldOccurrence | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FieldOccurrence | null>(null);

  const [values, setValues] = useState<FormValues>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refresh = useCallback(async () => {
    if (!executionId) return;
    setLoading(true);
    setError(null);
    try {
      setItems(await listOccurrences(executionId));
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar as ocorrências.",
      );
    } finally {
      setLoading(false);
    }
  }, [executionId]);

  useEffect(() => {
    if (!open || !executionId) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setItems([]);
    setFormVisible(false);
    setEditTarget(null);
    setDeleteTarget(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    refresh();
  }, [open, executionId, refresh]);

  function openForm(target: FieldOccurrence | null) {
    setEditTarget(target);
    setValues(
      target
        ? {
            logType: target.logType ?? "",
            description: target.description,
            weatherObservation: target.weatherObservation ?? "",
            evidenceUrl: target.evidenceUrl ?? "",
          }
        : EMPTY,
    );
    setFieldErrors({});
    setFormError(null);
    setFormVisible(true);
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
    if (!executionId) return;
    setFormError(null);
    const errors = validate(values);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    // Edição envia todos os campos atuais. Opcional esvaziado vai como texto
    // vazio: no back real o PUT ignora `null` (mantém o valor antigo), só ""
    // limpa o campo. No cadastro, opcional vazio vai como null.
    const emptyValue = editTarget ? "" : null;
    const payload = {
      logType: values.logType as OccurrenceType,
      description: values.description.trim(),
      weatherObservation: values.weatherObservation.trim() || emptyValue,
      evidenceUrl: values.evidenceUrl.trim() || emptyValue,
    };
    setSubmitting(true);
    try {
      if (editTarget) await updateOccurrence(editTarget.id, payload);
      else await createOccurrence(executionId, payload);
      setFormVisible(false);
      setEditTarget(null);
      await refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        const fromApi = err.status === 400 ? parseOccurrenceFieldErrors(err.payload) : {};
        if (Object.keys(fromApi).length > 0) {
          setFieldErrors(fromApi);
        } else {
          setFormError(err.message);
        }
      } else {
        setFormError("Não foi possível salvar a ocorrência.");
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
      await deleteOccurrence(deleteTarget.id);
      setDeleteTarget(null);
      await refresh();
    } catch (err) {
      setDeleteError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível excluir a ocorrência.",
      );
    } finally {
      setDeleting(false);
    }
  }

  function renderList() {
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
          Nenhuma ocorrência registrada neste apontamento
        </p>
      );
    }
    return (
      <ul className="flex flex-col gap-3">
        {items.map((item) => {
          const label = item.logType ? OCCURRENCE_TYPE_LABELS[item.logType] : "Ocorrência";
          return (
            <li key={item.id} className="rounded-lg border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col items-start gap-1">
                  {item.logType ? (
                    <span
                      data-type={item.logType}
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${TYPE_STYLES[item.logType]}`}
                    >
                      {label}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    Registrada em {formatPlanDate(item.createdAt)}
                  </span>
                </div>
                {canWrite && (
                  <div className="inline-flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Editar ocorrência ${label}`}
                      onClick={() => openForm(item)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Excluir ocorrência ${label}`}
                      onClick={() => {
                        setDeleteError(null);
                        setDeleteTarget(item);
                      }}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                )}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{item.description}</p>
              {item.weatherObservation && (
                <p className="mt-1 text-sm text-muted-foreground">
                  Clima: {item.weatherObservation}
                </p>
              )}
              {item.evidenceUrl &&
                (isSafeEvidenceUrl(item.evidenceUrl) ? (
                  <a
                    href={item.evidenceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    Ver evidência
                    <ExternalLink className="size-3.5" />
                  </a>
                ) : (
                  <p className="mt-1 break-all text-sm text-muted-foreground">
                    Evidência: {item.evidenceUrl}
                  </p>
                ))}
            </li>
          );
        })}
      </ul>
    );
  }

  const description = execution
    ? `Apontamento de ${formatPlanDate(execution.harvestedAt)}: clima, pragas e doenças observadas.`
    : "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Ocorrências do apontamento</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

        {formVisible && canWrite ? (
          <form
            noValidate
            onSubmit={handleSubmit}
            className="flex flex-1 flex-col overflow-y-auto"
          >
            <div className="flex flex-1 flex-col gap-4 px-4 pb-4">
              <h4 className="text-sm font-medium">
                {editTarget ? "Editar ocorrência" : "Nova ocorrência"}
              </h4>
              <div aria-live="polite">
                {formError && <ErrorBox message={formError} />}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="occurrence-type">Tipo</Label>
                <select
                  id="occurrence-type"
                  value={values.logType}
                  onChange={(e) => update("logType", e.target.value)}
                  disabled={submitting}
                  aria-invalid={Boolean(fieldErrors.logType)}
                  className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 aria-invalid:border-destructive md:text-sm dark:bg-input/30"
                >
                  <option value="">Selecione…</option>
                  {OCCURRENCE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {OCCURRENCE_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
                {fieldErrors.logType && (
                  <p className="text-sm text-destructive">{fieldErrors.logType}</p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="occurrence-description">Descrição</Label>
                <textarea
                  id="occurrence-description"
                  rows={3}
                  value={values.description}
                  onChange={(e) => update("description", e.target.value)}
                  disabled={submitting}
                  aria-invalid={Boolean(fieldErrors.description)}
                  className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 aria-invalid:border-destructive md:text-sm dark:bg-input/30"
                />
                {fieldErrors.description && (
                  <p className="text-sm text-destructive">{fieldErrors.description}</p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="occurrence-weather">Observação climática (opcional)</Label>
                <Input
                  id="occurrence-weather"
                  value={values.weatherObservation}
                  onChange={(e) => update("weatherObservation", e.target.value)}
                  disabled={submitting}
                  aria-invalid={Boolean(fieldErrors.weatherObservation)}
                />
                {fieldErrors.weatherObservation && (
                  <p className="text-sm text-destructive">
                    {fieldErrors.weatherObservation}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="occurrence-evidence">Link da evidência (opcional)</Label>
                <Input
                  id="occurrence-evidence"
                  inputMode="url"
                  value={values.evidenceUrl}
                  onChange={(e) => update("evidenceUrl", e.target.value)}
                  disabled={submitting}
                  placeholder="https://…"
                  aria-invalid={Boolean(fieldErrors.evidenceUrl)}
                />
                {fieldErrors.evidenceUrl && (
                  <p className="text-sm text-destructive">{fieldErrors.evidenceUrl}</p>
                )}
              </div>
            </div>
            <SheetFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormVisible(false)}
                disabled={submitting}
              >
                Voltar à lista
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
            </SheetFooter>
          </form>
        ) : (
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
            {canWrite && (
              <div>
                <Button type="button" size="sm" variant="outline" onClick={() => openForm(null)}>
                  <Plus />
                  Adicionar ocorrência
                </Button>
              </div>
            )}
            {renderList()}
          </div>
        )}

        {canWrite && (
          <AlertDialog
            open={deleteTarget !== null}
            onOpenChange={(next) => {
              if (!next && !deleting) setDeleteTarget(null);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir ocorrência</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação removerá a ocorrência{" "}
                  <span className="font-medium text-foreground">
                    {deleteTarget?.logType
                      ? OCCURRENCE_TYPE_LABELS[deleteTarget.logType]
                      : ""}
                  </span>{" "}
                  ({deleteTarget?.description}) do apontamento. Não é possível desfazer.
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
        )}
      </SheetContent>
    </Sheet>
  );
}
