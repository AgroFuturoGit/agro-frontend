"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ExternalLink, Loader2, MessageSquareWarning, Pencil, Plus, Trash2 } from "lucide-react";

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
import { EmptyState } from "@/components/admin/empty-state";
import { EmptyValue } from "@/components/admin/empty-value";
import { DataTableRowActions } from "@/components/data-table/data-table-row-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, userFacingErrorHint } from "@/lib/api";
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
import { OCCURRENCE_TYPE_VARIANT } from "@/lib/status-variants";
import { LIMITS } from "@/lib/validation";

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
const MAX_DESCRIPTION = LIMITS.OCCURRENCE_DESCRIPTION;
const MAX_WEATHER = LIMITS.OCCURRENCE_WEATHER;
const MAX_URL = LIMITS.OCCURRENCE_EVIDENCE_URL;

function validate(values: FormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values.logType) errors.logType = "O tipo de ocorrência é obrigatório";
  if (!values.description.trim()) errors.description = "A descrição é obrigatória";
  else if (values.description.trim().length > MAX_DESCRIPTION)
    errors.description = `A descrição deve ter no máximo ${MAX_DESCRIPTION} caracteres`;
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

  // Sequência da última carga: respostas de apontamento ou carga antigos são descartadas.
  const loadSeq = useRef(0);
  // Abrir/fechar o formulário desmonta o botão focado: o foco vai para o
  // primeiro campo ao abrir e volta para "Adicionar ocorrência" ao fechar.
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const focusAfterToggle = useRef<"form" | "add" | null>(null);

  useEffect(() => {
    const target = focusAfterToggle.current;
    if (!target) return;
    focusAfterToggle.current = null;
    if (target === "form" && formVisible) {
      document.getElementById("occurrence-type")?.focus();
    } else if (target === "add" && !formVisible) {
      addButtonRef.current?.focus();
    }
  }, [formVisible]);

  const refresh = useCallback(async () => {
    if (!executionId) return;
    const seq = ++loadSeq.current;
    setLoading(true);
    setError(null);
    try {
      const data = await listOccurrences(executionId);
      if (seq === loadSeq.current) setItems(data);
    } catch (err) {
      if (seq !== loadSeq.current) return;
      setError(
        (err instanceof ApiError ? userFacingErrorHint(err.message) : undefined) ??
          "Não foi possível carregar as ocorrências.",
      );
    } finally {
      if (seq === loadSeq.current) setLoading(false);
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
    focusAfterToggle.current = "form";
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
      focusAfterToggle.current = "add";
      setFormVisible(false);
      setEditTarget(null);
      await refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        const fromApi = err.status === 400 ? parseOccurrenceFieldErrors(err.payload) : {};
        if (Object.keys(fromApi).length > 0) {
          setFieldErrors(fromApi);
        } else {
          setFormError(
            userFacingErrorHint(err.message) ?? "Não foi possível salvar a ocorrência.",
          );
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
        (err instanceof ApiError ? userFacingErrorHint(err.message) : undefined) ??
          "Não foi possível excluir a ocorrência.",
      );
    } finally {
      setDeleting(false);
    }
  }

  function renderList() {
    if (loading) {
      return (
        <div aria-busy="true" className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full rounded-xl" />
          <span className="sr-only">Carregando ocorrências…</span>
        </div>
      );
    }
    if (error) {
      return (
        <InlineAlert
          variant="destructive"
          action={{ label: "Tentar novamente", onClick: () => refresh() }}
        >
          {error}
        </InlineAlert>
      );
    }
    if (items.length === 0) {
      return (
        <EmptyState
          variant="card"
          icon={MessageSquareWarning}
          className="py-8"
          title="Nenhuma ocorrência registrada neste apontamento"
          hint={
            canWrite
              ? "Use “Adicionar ocorrência” para registrar clima, pragas ou doenças observadas."
              : undefined
          }
        />
      );
    }
    return (
      <ul className="flex flex-col gap-3">
        {items.map((item) => {
          const label = item.logType ? OCCURRENCE_TYPE_LABELS[item.logType] : "Ocorrência";
          return (
            <li key={item.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col items-start gap-1">
                  {item.logType ? (
                    // Tipo é categoria, não status: badge outline (sem cor semântica).
                    <Badge
                      data-type={item.logType}
                      variant={OCCURRENCE_TYPE_VARIANT[item.logType]}
                    >
                      {label}
                    </Badge>
                  ) : (
                    <EmptyValue />
                  )}
                  <span className="text-xs text-muted-foreground">
                    Registrada em {formatPlanDate(item.createdAt)}
                  </span>
                </div>
                {canWrite && (
                  <DataTableRowActions
                    align="end"
                    className="shrink-0"
                    actions={[
                      {
                        label: `Editar ocorrência ${label}`,
                        icon: Pencil,
                        onClick: () => openForm(item),
                      },
                      {
                        label: `Excluir ocorrência ${label}`,
                        icon: Trash2,
                        tone: "destructive",
                        onClick: () => {
                          setDeleteError(null);
                          setDeleteTarget(item);
                        },
                      },
                    ]}
                  />
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
                    className="mt-1 inline-flex items-center gap-1 rounded-sm text-sm text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    Ver evidência
                    <ExternalLink aria-hidden="true" className="size-3.5" />
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
              {/* O role="alert" do InlineAlert já anuncia: sem aria-live em volta. */}
              {formError && <InlineAlert variant="destructive">{formError}</InlineAlert>}
              <div className="flex flex-col gap-2">
                <Label htmlFor="occurrence-type">Tipo</Label>
                <NativeSelect
                  id="occurrence-type"
                  className="w-full"
                  value={values.logType}
                  onChange={(e) => update("logType", e.target.value)}
                  disabled={submitting}
                  aria-invalid={Boolean(fieldErrors.logType)}
                  aria-describedby={fieldErrors.logType ? "occurrence-type-error" : undefined}
                >
                  <NativeSelectOption value="">Selecione…</NativeSelectOption>
                  {OCCURRENCE_TYPES.map((type) => (
                    <NativeSelectOption key={type} value={type}>
                      {OCCURRENCE_TYPE_LABELS[type]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                {fieldErrors.logType && (
                  <p id="occurrence-type-error" className="text-sm text-destructive">{fieldErrors.logType}</p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="occurrence-description">Descrição</Label>
                <Textarea
                  id="occurrence-description"
                  rows={3}
                  maxLength={MAX_DESCRIPTION}
                  value={values.description}
                  onChange={(e) => update("description", e.target.value)}
                  disabled={submitting}
                  aria-invalid={Boolean(fieldErrors.description)}
                  aria-describedby={fieldErrors.description ? "occurrence-description-error" : undefined}
                  className="min-h-20"
                />
                {fieldErrors.description && (
                  <p id="occurrence-description-error" className="text-sm text-destructive">{fieldErrors.description}</p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="occurrence-weather">Observação climática (opcional)</Label>
                <Input
                  id="occurrence-weather"
                  maxLength={MAX_WEATHER}
                  value={values.weatherObservation}
                  onChange={(e) => update("weatherObservation", e.target.value)}
                  disabled={submitting}
                  aria-invalid={Boolean(fieldErrors.weatherObservation)}
                  aria-describedby={fieldErrors.weatherObservation ? "occurrence-weather-error" : undefined}
                />
                {fieldErrors.weatherObservation && (
                  <p id="occurrence-weather-error" className="text-sm text-destructive">
                    {fieldErrors.weatherObservation}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="occurrence-evidence">Link da evidência (opcional)</Label>
                <Input
                  id="occurrence-evidence"
                  maxLength={MAX_URL}
                  inputMode="url"
                  value={values.evidenceUrl}
                  onChange={(e) => update("evidenceUrl", e.target.value)}
                  disabled={submitting}
                  placeholder="https://…"
                  aria-invalid={Boolean(fieldErrors.evidenceUrl)}
                  aria-describedby={fieldErrors.evidenceUrl ? "occurrence-evidence-error" : undefined}
                />
                {fieldErrors.evidenceUrl && (
                  <p id="occurrence-evidence-error" className="text-sm text-destructive">{fieldErrors.evidenceUrl}</p>
                )}
              </div>
            </div>
            <SheetFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  focusAfterToggle.current = "add";
                  setFormVisible(false);
                }}
                disabled={submitting}
              >
                Voltar à lista
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
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
                <Button
                  ref={addButtonRef}
                  type="button"
                  variant="outline"
                  onClick={() => openForm(null)}
                >
                  <Plus aria-hidden="true" />
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
              {deleteError && <InlineAlert variant="destructive">{deleteError}</InlineAlert>}
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? (
                    <>
                      <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
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
