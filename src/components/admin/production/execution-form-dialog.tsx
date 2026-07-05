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
import {
  createProductionExecution,
  updateProductionExecution,
  type ProductionExecution,
} from "@/lib/production";

type Mode = "create" | "edit";

type Props = {
  mode: Mode;
  planId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  execution?: ProductionExecution | null;
};

type FormValues = {
  actualYield: string;
  harvestDate: string;
};

const EMPTY: FormValues = {
  actualYield: "",
  harvestDate: "",
};

function validate(values: FormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  const value = Number(values.actualYield);
  if (!values.actualYield || !Number.isFinite(value) || value <= 0) {
    errors.actualYield = "Informe uma quantidade maior que zero";
  }
  if (!values.harvestDate) errors.harvestDate = "Informe a data da colheita";
  return errors;
}

export function ExecutionFormDialog({
  mode,
  planId,
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
        actualYield: String(execution.actualYield ?? ""),
        harvestDate: execution.harvestDate ?? "",
      });
    } else {
      setValues(EMPTY);
    }
  }, [open, mode, execution]);

  const isDirty = useMemo(() => {
    if (isCreate) return true;
    if (!execution) return false;
    return (
      values.actualYield !== String(execution.actualYield ?? "") ||
      values.harvestDate !== (execution.harvestDate ?? "")
    );
  }, [isCreate, values, execution]);

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

    const errors = validate(values);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        actualYield: Number(values.actualYield),
        harvestDate: values.harvestDate,
      };
      if (isCreate) {
        await createProductionExecution(planId, payload);
      } else if (execution) {
        await updateProductionExecution(execution.id, payload);
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
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
    ? "Registre a fração colhida e a data do trator em campo."
    : "Corrija a quantidade ou a data deste apontamento.";

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
            <Label htmlFor="execution-yield">Quantidade colhida (t)</Label>
            <Input
              id="execution-yield"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              value={values.actualYield}
              onChange={(e) => update("actualYield", e.target.value)}
              required
              disabled={submitting}
              aria-invalid={Boolean(fieldErrors.actualYield)}
            />
            {fieldErrors.actualYield && (
              <p className="text-sm text-destructive">
                {fieldErrors.actualYield}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="execution-date">Data da colheita</Label>
            <Input
              id="execution-date"
              type="date"
              value={values.harvestDate}
              onChange={(e) => update("harvestDate", e.target.value)}
              required
              disabled={submitting}
              aria-invalid={Boolean(fieldErrors.harvestDate)}
            />
            {fieldErrors.harvestDate && (
              <p className="text-sm text-destructive">
                {fieldErrors.harvestDate}
              </p>
            )}
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
