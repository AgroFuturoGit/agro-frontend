"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

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
import { formatCpf } from "@/lib/cpf";
import {
  parseManagerRegisterFieldErrors,
  registerManager,
} from "@/lib/organizations";

type Props = {
  /** Organização de destino — sem seletor, já contextual à linha clicada. */
  organizationId: string;
  organizationName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type FormValues = {
  fullName: string;
  email: string;
  password: string;
  cpf: string;
  dateOfBirth: string;
};

const EMPTY: FormValues = {
  fullName: "",
  email: "",
  password: "",
  cpf: "",
  dateOfBirth: "",
};

function validateField(
  field: keyof FormValues,
  values: FormValues,
): string | null {
  if (field === "password") {
    if (!values.password) return "Informe a senha";
    if (values.password.length < 8) {
      return "A senha deve ter no mínimo 8 caracteres";
    }
    return null;
  }

  if (!values[field].trim()) {
    switch (field) {
      case "fullName":
        return "Informe o nome completo";
      case "email":
        return "Informe o e-mail";
      case "cpf":
        return "Informe o CPF";
      case "dateOfBirth":
        return "Informe a data de nascimento";
      default:
        return "Campo obrigatório";
    }
  }
  return null;
}

function validateAll(values: FormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  (Object.keys(values) as (keyof FormValues)[]).forEach((field) => {
    const error = validateField(field, values);
    if (error) errors[field] = error;
  });
  return errors;
}

export function ManagerRegisterDialog({
  organizationId,
  organizationName,
  open,
  onOpenChange,
}: Props) {
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [registeredName, setRegisteredName] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValues(EMPTY);
    setFieldErrors({});
    setFormError(null);
    setRegisteredName(null);
  }, [open]);

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
      const result = await registerManager(organizationId, {
        fullName: values.fullName.trim(),
        email: values.email.trim(),
        password: values.password,
        cpf: values.cpf.trim(),
        dateOfBirth: values.dateOfBirth,
      });
      setRegisteredName(result.user.fullName);
    } catch (err) {
      if (err instanceof ApiError) {
        const apiFieldErrors = parseManagerRegisterFieldErrors(err.payload);
        if (Object.keys(apiFieldErrors).length > 0) {
          setFieldErrors(apiFieldErrors);
        }
        setFormError(err.message);
      } else {
        setFormError("Não foi possível cadastrar o gestor.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {registeredName ? (
          <>
            <DialogHeader>
              <DialogTitle>Gestor cadastrado</DialogTitle>
              <DialogDescription>
                O gestor foi vinculado à organização &quot;{organizationName}
                &quot;.
              </DialogDescription>
            </DialogHeader>

            <div
              role="status"
              className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400"
            >
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              <span>
                <strong>{registeredName}</strong> foi cadastrado(a) como
                gestor(a) desta organização.
              </span>
            </div>

            <DialogFooter>
              <Button type="button" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Novo gestor</DialogTitle>
              <DialogDescription>
                Cadastre um gestor vinculado à organização &quot;
                {organizationName}&quot;.
              </DialogDescription>
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
                <Label htmlFor="manager-full-name">Nome completo</Label>
                <Input
                  id="manager-full-name"
                  value={values.fullName}
                  onChange={(e) => update("fullName", e.target.value)}
                  onBlur={() => handleBlur("fullName")}
                  required
                  disabled={submitting}
                  autoComplete="name"
                  aria-invalid={Boolean(fieldErrors.fullName)}
                />
                {fieldErrors.fullName && (
                  <p className="text-sm text-destructive">
                    {fieldErrors.fullName}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="manager-email">E-mail</Label>
                <Input
                  id="manager-email"
                  type="email"
                  value={values.email}
                  onChange={(e) => update("email", e.target.value)}
                  onBlur={() => handleBlur("email")}
                  required
                  disabled={submitting}
                  autoComplete="email"
                  aria-invalid={Boolean(fieldErrors.email)}
                />
                {fieldErrors.email && (
                  <p className="text-sm text-destructive">
                    {fieldErrors.email}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="manager-password">Senha</Label>
                <Input
                  id="manager-password"
                  type="password"
                  value={values.password}
                  onChange={(e) => update("password", e.target.value)}
                  onBlur={() => handleBlur("password")}
                  required
                  minLength={8}
                  disabled={submitting}
                  autoComplete="new-password"
                  aria-invalid={Boolean(fieldErrors.password)}
                />
                {fieldErrors.password && (
                  <p className="text-sm text-destructive">
                    {fieldErrors.password}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="manager-cpf">CPF</Label>
                <Input
                  id="manager-cpf"
                  value={values.cpf}
                  onChange={(e) => update("cpf", formatCpf(e.target.value))}
                  onBlur={() => handleBlur("cpf")}
                  required
                  inputMode="numeric"
                  maxLength={14}
                  placeholder="000.000.000-00"
                  disabled={submitting}
                  aria-invalid={Boolean(fieldErrors.cpf)}
                />
                {fieldErrors.cpf && (
                  <p className="text-sm text-destructive">
                    {fieldErrors.cpf}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="manager-date-of-birth">
                  Data de nascimento
                </Label>
                <Input
                  id="manager-date-of-birth"
                  type="date"
                  value={values.dateOfBirth}
                  onChange={(e) => update("dateOfBirth", e.target.value)}
                  onBlur={() => handleBlur("dateOfBirth")}
                  required
                  disabled={submitting}
                  aria-invalid={Boolean(fieldErrors.dateOfBirth)}
                />
                {fieldErrors.dateOfBirth && (
                  <p className="text-sm text-destructive">
                    {fieldErrors.dateOfBirth}
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
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Cadastrando…
                    </>
                  ) : (
                    "Cadastrar"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
