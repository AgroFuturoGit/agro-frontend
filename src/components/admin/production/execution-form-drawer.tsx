"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { unitFactorKg, unitLabel, type Crop } from "@/lib/crops";
import {
  createProductionExecution,
  formatNumber,
  updateProductionExecution,
  type ProductionExecution,
} from "@/lib/production";

export const MISSING_UNIT_WEIGHT_MESSAGE =
  "Cadastre o peso da unidade na cultura antes de registrar apontamentos";

export const RESUBMIT_WARNING =
  "Alterar quantidade ou data reenvia o apontamento para validação.";

type Mode = "create" | "edit";

type Props = {
  mode: Mode;
  planId: string;
  /** Cultura do plano: define a unidade e o fator de conversão para kg. */
  crop: Crop | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  execution?: ProductionExecution | null;
};

type FormValues = {
  quantity: string;
  harvestedAt: string;
  notes: string;
};

const EMPTY: FormValues = {
  quantity: "",
  harvestedAt: "",
  notes: "",
};

function validate(values: FormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  const value = Number(values.quantity);
  if (!values.quantity || !Number.isFinite(value) || value <= 0) {
    errors.quantity = "Informe uma quantidade maior que zero";
  }
  if (!values.harvestedAt) errors.harvestedAt = "Informe a data da colheita";
  return errors;
}

/** Arredonda a 2 casas para evitar ruído de ponto flutuante (ex.: 0.1 × 3). */
function toKg(quantity: number, factor: number): number {
  return Math.round(quantity * factor * 100) / 100;
}

export function ExecutionFormDrawer({
  mode,
  planId,
  crop,
  open,
  onOpenChange,
  onSaved,
  execution,
}: Props) {
  const isCreate = mode === "create";
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFormError(null);
    setFieldErrors({});
    if (mode === "edit" && execution) {
      setValues({
        quantity: String(execution.quantity ?? ""),
        harvestedAt: execution.harvestedAt ?? "",
        notes: execution.notes ?? "",
      });
    } else {
      setValues(EMPTY);
    }
  }, [open, mode, execution]);

  const isDirty = useMemo(() => {
    if (isCreate) return true;
    if (!execution) return false;
    return (
      values.quantity !== String(execution.quantity ?? "") ||
      values.harvestedAt !== (execution.harvestedAt ?? "") ||
      values.notes !== (execution.notes ?? "")
    );
  }, [isCreate, values, execution]);

  const factor = unitFactorKg(crop);
  const blocked = factor === null;
  const quantityNumber = Number(values.quantity);
  const previewKg =
    factor !== null && values.quantity && Number.isFinite(quantityNumber) && quantityNumber > 0
      ? toKg(quantityNumber, factor)
      : null;
  const unitText = unitLabel(crop?.unit ?? null, 2);

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
    if (formError) setFormError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (factor === null) return;

    const errors = validate(values);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      const quantity = Number(values.quantity);
      // Se a quantidade não mudou na edição, preserva o kg já gravado (a
      // unidade da cultura pode ter mudado depois do apontamento).
      const quantityKg =
        !isCreate && execution && quantity === execution.quantity
          ? execution.quantityKg
          : toKg(quantity, factor);
      // Nunca envia status/validatedBy/validatedAt: a validação não é do front.
      const payload = {
        quantity,
        quantityKg,
        harvestedAt: values.harvestedAt,
        notes: values.notes.trim() || null,
      };
      if (isCreate) {
        await createProductionExecution(planId, payload);
      } else if (execution) {
        // Com a versão que estava na tela, o back recusa (409) se alguém
        // mudou o apontamento depois — em vez de sobrescrever em silêncio.
        await updateProductionExecution(execution.id, {
          ...payload,
          baseUpdatedAt: execution.updatedAt,
        });
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // A lista por trás do drawer está desatualizada: recarrega para o
        // usuário ver a versão atual antes de tentar de novo.
        onSaved();
        setFormError(
          "Este apontamento foi alterado por outra pessoa enquanto você editava. Os dados foram atualizados; feche e abra a edição novamente para continuar.",
        );
        return;
      }
      setFormError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível salvar o apontamento.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const title = isCreate ? "Novo apontamento" : "Editar apontamento";
  const description = isCreate
    ? "Registre a quantidade colhida na unidade da cultura e a data da colheita."
    : "Corrija a quantidade, a data ou as observações deste apontamento.";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

        <form
          noValidate
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col overflow-y-auto"
        >
          <div className="flex flex-1 flex-col gap-4 px-4 pb-4">
            <div aria-live="polite">
              {formError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}
            </div>

            {!isCreate && execution?.status === "REJECTED" && (
              <div
                role="status"
                className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{RESUBMIT_WARNING}</span>
              </div>
            )}

            {!isCreate && execution?.status === "REJECTED" && execution.rejectionReason && (
              <p className="text-sm text-muted-foreground">
                Motivo da rejeição: {execution.rejectionReason}
              </p>
            )}

            {blocked && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{MISSING_UNIT_WEIGHT_MESSAGE}</span>
              </div>
            )}

            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor="execution-quantity">
                  Quantidade colhida ({unitText})
                </Label>
                <Input
                  id="execution-quantity"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0.01"
                  value={values.quantity}
                  onChange={(e) => update("quantity", e.target.value)}
                  required
                  disabled={submitting}
                  aria-invalid={Boolean(fieldErrors.quantity)}
                />
                {fieldErrors.quantity && (
                  <p className="text-sm text-destructive">{fieldErrors.quantity}</p>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor="execution-quantity-kg">Peso em kg</Label>
                <Input
                  id="execution-quantity-kg"
                  readOnly
                  value={previewKg === null ? "—" : `${formatNumber(previewKg)} kg`}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="execution-date">Data da colheita</Label>
              <Input
                id="execution-date"
                type="date"
                value={values.harvestedAt}
                onChange={(e) => update("harvestedAt", e.target.value)}
                required
                disabled={submitting}
                aria-invalid={Boolean(fieldErrors.harvestedAt)}
              />
              {fieldErrors.harvestedAt && (
                <p className="text-sm text-destructive">{fieldErrors.harvestedAt}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="execution-notes">Observações</Label>
              <Input
                id="execution-notes"
                value={values.notes}
                onChange={(e) => update("notes", e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting || !isDirty || blocked}>
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" />
                  Salvando…
                </>
              ) : isCreate ? (
                "Salvar"
              ) : (
                "Salvar alterações"
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
