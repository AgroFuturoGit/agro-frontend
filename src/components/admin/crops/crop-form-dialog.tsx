"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  createCrop,
  parseCropFieldErrors,
  updateCrop,
  type Crop,
} from "@/lib/crops";

type Mode = "create" | "edit";

type Props = {
  mode: Mode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  crop?: Crop | null;
};

type FormValues = {
  name: string;
  variety: string;
  isPriority: boolean;
};

const EMPTY: FormValues = {
  name: "",
  variety: "",
  isPriority: false,
};

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function validateField(field: keyof FormValues, value: FormValues): string | null {
  if (field === "isPriority") return null;
  const trimmed = value[field].trim();
  if (!trimmed) {
    return field === "name"
      ? "Informe o nome da cultura"
      : "Informe a variedade";
  }
  if (trimmed.length < 2) {
    return field === "name"
      ? "Informe o nome da cultura"
      : "Informe a variedade";
  }
  return null;
}

function validateAll(values: FormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  const nameError = validateField("name", values);
  const varietyError = validateField("variety", values);
  if (nameError) errors.name = nameError;
  if (varietyError) errors.variety = varietyError;
  return errors;
}

export function CropFormDialog({
  mode,
  open,
  onOpenChange,
  onSaved,
  crop,
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
    if (mode === "edit" && crop) {
      const next = {
        name: crop.name,
        variety: crop.variety,
        isPriority: crop.isPriority,
      };
      setValues(next);
      setInitialValues(next);
    } else {
      setValues(EMPTY);
      setInitialValues(EMPTY);
    }
  }, [open, mode, crop]);

  const isDirty = useMemo(() => {
    if (mode !== "edit") return true;
    return (
      values.name.trim() !== initialValues.name.trim() ||
      values.variety.trim() !== initialValues.variety.trim() ||
      values.isPriority !== initialValues.isPriority
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
        name: values.name.trim(),
        variety: values.variety.trim(),
        isPriority: values.isPriority,
      };
      if (mode === "create") {
        await createCrop(payload);
      } else if (crop) {
        await updateCrop(crop.id, payload);
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError) {
        const apiFieldErrors = parseCropFieldErrors(err.payload);
        if (Object.keys(apiFieldErrors).length > 0) {
          setFieldErrors(apiFieldErrors);
        }
        setFormError(err.message);
      } else {
        setFormError("Não foi possível salvar a cultura.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const isCreate = mode === "create";
  const title = isCreate ? "Nova cultura" : "Editar cultura";
  const description = isCreate
    ? "Cadastre uma nova cultura agrícola."
    : "Atualize os dados da cultura selecionada.";

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

          {!isCreate && crop && (
            <>
              <p className="text-xs text-muted-foreground">
                Última atualização: {formatDateTime(crop.updatedAt)}
              </p>
            </>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="crop-name">Nome da cultura</Label>
            <Input
              id="crop-name"
              value={values.name}
              onChange={(e) => update("name", e.target.value)}
              onBlur={() => handleBlur("name")}
              required
              disabled={submitting}
              aria-invalid={Boolean(fieldErrors.name)}
            />
            {fieldErrors.name && (
              <p className="text-sm text-destructive">{fieldErrors.name}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="crop-variety">Variedade</Label>
            <Input
              id="crop-variety"
              value={values.variety}
              onChange={(e) => update("variety", e.target.value)}
              onBlur={() => handleBlur("variety")}
              required
              disabled={submitting}
              aria-invalid={Boolean(fieldErrors.variety)}
            />
            {fieldErrors.variety && (
              <p className="text-sm text-destructive">{fieldErrors.variety}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="crop-is-priority"
              checked={values.isPriority}
              onCheckedChange={(checked) =>
                update("isPriority", checked === true)
              }
              disabled={submitting}
            />
            <Label htmlFor="crop-is-priority" className="font-normal">
              Cultura prioritária
            </Label>
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
