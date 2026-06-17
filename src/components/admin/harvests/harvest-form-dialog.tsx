"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { ApiError } from "@/lib/api";
import { createHarvest, updateHarvest, type Harvest } from "@/lib/harvests";

type Mode = "create" | "edit";

type Props = {
  mode: Mode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  harvest?: Harvest | null;
};

type FormValues = {
  label: string;
  startDate: string;
  endDate: string;
};

const EMPTY: FormValues = {
  label: "",
  startDate: "",
  endDate: "",
};

function validateField(
  field: keyof FormValues,
  values: FormValues,
): string | null {
  if (field === "label") {
    const trimmed = values.label.trim();
    if (!trimmed) return "Informe o rótulo da safra";
    if (trimmed.length < 2) return "Informe o rótulo da safra";
    return null;
  }
  if (field === "startDate") {
    if (!values.startDate) return "Informe a data de início";
    return null;
  }
  if (field === "endDate") {
    if (!values.endDate) return "Informe a data de término";
    if (
      values.startDate &&
      values.endDate &&
      values.startDate > values.endDate
    ) {
      return "A data de término deve ser igual ou posterior à de início";
    }
    return null;
  }
  return null;
}

function validateAll(values: FormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  (["label", "startDate", "endDate"] as const).forEach((field) => {
    const error = validateField(field, values);
    if (error) errors[field] = error;
  });
  return errors;
}

export function HarvestFormDialog({
  mode,
  open,
  onOpenChange,
  onSaved,
  harvest,
}: Props) {
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [initialValues, setInitialValues] = useState<FormValues>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFormError(null);
    setFieldErrors({});
    if (mode === "edit" && harvest) {
      const next = {
        label: harvest.label,
        startDate: harvest.startDate,
        endDate: harvest.endDate,
      };
      setValues(next);
      setInitialValues(next);
    } else {
      setValues(EMPTY);
      setInitialValues(EMPTY);
    }
  }, [open, mode, harvest]);

  const isDirty = useMemo(() => {
    if (mode !== "edit") return true;
    return (
      values.label.trim() !== initialValues.label.trim() ||
      values.startDate !== initialValues.startDate ||
      values.endDate !== initialValues.endDate
    );
  }, [mode, values, initialValues]);

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

  function handleBlur(field: keyof FormValues) {
    const error = validateField(field, values);
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (error) next[field] = error;
      else delete next[field];
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const clientErrors = validateAll(values);
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        label: values.label.trim(),
        startDate: values.startDate,
        endDate: values.endDate,
      };
      if (mode === "create") {
        await createHarvest(payload);
      } else if (harvest) {
        await updateHarvest(harvest.id, payload);
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setFormError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível salvar a safra.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const isCreate = mode === "create";
  const title = isCreate ? "Nova safra" : "Editar safra";
  const description = isCreate
    ? "Cadastre uma nova safra."
    : "Atualize os dados da safra selecionada.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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

          <div className="flex flex-col gap-2">
            <Label htmlFor="harvest-label">Rótulo</Label>
            <Input
              id="harvest-label"
              value={values.label}
              onChange={(e) => update("label", e.target.value)}
              onBlur={() => handleBlur("label")}
              placeholder="Ex.: Safra 2025/2026"
              required
              disabled={submitting}
              aria-invalid={Boolean(fieldErrors.label)}
            />
            {fieldErrors.label && (
              <p className="text-sm text-destructive">{fieldErrors.label}</p>
            )}
          </div>

          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="harvest-start-date">Data de início</Label>
              <Input
                id="harvest-start-date"
                type="date"
                value={values.startDate}
                onChange={(e) => update("startDate", e.target.value)}
                onBlur={() => handleBlur("startDate")}
                required
                disabled={submitting}
                aria-invalid={Boolean(fieldErrors.startDate)}
              />
              {fieldErrors.startDate && (
                <p className="text-sm text-destructive">
                  {fieldErrors.startDate}
                </p>
              )}
            </div>

            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="harvest-end-date">Data de término</Label>
              <Input
                id="harvest-end-date"
                type="date"
                value={values.endDate}
                min={values.startDate || undefined}
                onChange={(e) => update("endDate", e.target.value)}
                onBlur={() => handleBlur("endDate")}
                required
                disabled={submitting}
                aria-invalid={Boolean(fieldErrors.endDate)}
              />
              {fieldErrors.endDate && (
                <p className="text-sm text-destructive">
                  {fieldErrors.endDate}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting || !isDirty}>
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
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
