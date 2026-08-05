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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api";
import { formatCnpj } from "@/lib/cnpj";
import {
  ORGANIZATION_TYPE_LABELS,
  createOrganization,
  parseOrganizationFieldErrors,
  updateOrganization,
  type Organization,
  type OrganizationType,
} from "@/lib/organizations";

type Mode = "create" | "edit";

type Props = {
  mode: Mode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  organization?: Organization | null;
};

type FormValues = {
  name: string;
  taxId: string;
  type: OrganizationType | "";
};

const EMPTY: FormValues = {
  name: "",
  taxId: "",
  type: "",
};

const ORGANIZATION_TYPES: OrganizationType[] = ["COOP", "ASSOC"];

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function validateName(values: FormValues): string | null {
  if (!values.name.trim()) return "Informe o nome da organização";
  return null;
}

function validateTaxId(values: FormValues): string | null {
  const digits = digitsOnly(values.taxId);
  if (!digits) return "Informe o CNPJ";
  if (digits.length !== 14) return "CNPJ deve ter 14 dígitos";
  return null;
}

function validateType(values: FormValues): string | null {
  if (!values.type) return "Selecione o tipo";
  return null;
}

function validateAll(
  values: FormValues,
  isCreate: boolean,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const nameError = validateName(values);
  if (nameError) errors.name = nameError;
  if (isCreate) {
    const taxIdError = validateTaxId(values);
    if (taxIdError) errors.taxId = taxIdError;
    const typeError = validateType(values);
    if (typeError) errors.type = typeError;
  }
  return errors;
}

export function OrganizationFormDialog({
  mode,
  open,
  onOpenChange,
  onSaved,
  organization,
}: Props) {
  const isCreate = mode === "create";

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
    if (mode === "edit" && organization) {
      const next: FormValues = {
        name: organization.name,
        taxId: organization.taxId,
        type: organization.type,
      };
      setValues(next);
      setInitialValues(next);
    } else {
      setValues(EMPTY);
      setInitialValues(EMPTY);
    }
  }, [open, mode, organization]);

  const isDirty = useMemo(() => {
    if (mode !== "edit") return true;
    // Em modo edição só `name` é editável — `type`/`taxId` são
    // read-only (ver regra de negócio em domain.md e achado da Task 01-01).
    return values.name.trim() !== initialValues.name.trim();
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

  function handleBlur(field: "name" | "taxId") {
    const error =
      field === "name" ? validateName(values) : validateTaxId(values);
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

    const clientErrors = validateAll(values, isCreate);
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      return;
    }

    setSubmitting(true);
    try {
      if (isCreate) {
        await createOrganization({
          name: values.name.trim(),
          taxId: values.taxId.trim(),
          type: values.type as OrganizationType,
        });
      } else if (organization) {
        // OrganizationUpdateDTO só aceita name/type — taxId é ignorado
        // silenciosamente pelo backend. Reenviamos os valores originais
        // de taxId/type inalterados (achado da Task 01-01, domain.md).
        await updateOrganization(organization.id, {
          name: values.name.trim(),
          taxId: organization.taxId,
          type: organization.type,
        });
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError) {
        const apiFieldErrors = parseOrganizationFieldErrors(err.payload);
        if (Object.keys(apiFieldErrors).length > 0) {
          setFieldErrors(apiFieldErrors);
        }
        setFormError(err.message);
      } else {
        setFormError("Não foi possível salvar a organização.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const title = isCreate ? "Nova organização" : "Editar organização";
  const description = isCreate
    ? "Cadastre uma nova organização (cooperativa ou associação)."
    : "Atualize os dados da organização selecionada.";

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
            <Label htmlFor="organization-name">Nome</Label>
            <Input
              id="organization-name"
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

          {isCreate ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="organization-tax-id">CNPJ</Label>
              <Input
                id="organization-tax-id"
                value={values.taxId}
                onChange={(e) => update("taxId", formatCnpj(e.target.value))}
                onBlur={() => handleBlur("taxId")}
                required
                inputMode="numeric"
                maxLength={18}
                placeholder="00.000.000/0000-00"
                disabled={submitting}
                aria-invalid={Boolean(fieldErrors.taxId)}
              />
              {fieldErrors.taxId && (
                <p className="text-sm text-destructive">
                  {fieldErrors.taxId}
                </p>
              )}
            </div>
          ) : (
            organization && (
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                <p className="text-xs text-muted-foreground">CNPJ</p>
                <p className="font-mono font-medium text-foreground">
                  {formatCnpj(organization.taxId)}
                </p>
              </div>
            )
          )}

          {isCreate ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="organization-type">Tipo</Label>
              <Select
                value={values.type}
                onValueChange={(value) =>
                  update("type", (value ?? "") as OrganizationType | "")
                }
                disabled={submitting}
              >
                <SelectTrigger id="organization-type" className="w-full">
                  <SelectValue placeholder="Selecione o tipo">
                    {(value) =>
                      value
                        ? ORGANIZATION_TYPE_LABELS[value as OrganizationType]
                        : "Selecione o tipo"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ORGANIZATION_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {ORGANIZATION_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.type && (
                <p className="text-sm text-destructive">{fieldErrors.type}</p>
              )}
            </div>
          ) : (
            organization && (
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                <p className="text-xs text-muted-foreground">Tipo</p>
                <p className="font-medium text-foreground">
                  {ORGANIZATION_TYPE_LABELS[organization.type]}
                </p>
              </div>
            )
          )}

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
