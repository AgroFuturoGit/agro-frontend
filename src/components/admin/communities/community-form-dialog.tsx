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
import type { Role } from "@/lib/auth";
import {
  createCommunity,
  parseCommunityFieldErrors,
  updateCommunity,
  type Community,
} from "@/lib/communities";
import { listOrganizations, type Organization } from "@/lib/organizations";

type Mode = "create" | "edit";

type Props = {
  mode: Mode;
  /**
   * Papel do usuário logado. Só `ADMIN` vê o seletor de organização —
   * qualquer outro papel usa a organização recebida em `organizationId`
   * (decisão D3: MANAGER nunca escolhe outra organização).
   */
  role: Role;
  /**
   * Organização fixa do MANAGER, já resolvida pela página pai via
   * `getMyManager()`. Ignorada quando `role === "ADMIN"`.
   * Este diálogo NUNCA chama `getMyManager()` por conta própria.
   */
  organizationId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  community?: Community | null;
};

type FormValues = {
  name: string;
  organizationId: string;
};

const EMPTY: FormValues = {
  name: "",
  organizationId: "",
};

function validateName(values: FormValues): string | null {
  if (!values.name.trim()) return "Informe o nome da comunidade";
  return null;
}

function validateAll(
  values: FormValues,
  needsOrganizationChoice: boolean,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const nameError = validateName(values);
  if (nameError) errors.name = nameError;
  if (needsOrganizationChoice && !values.organizationId) {
    errors.organizationId = "Selecione a organização";
  }
  return errors;
}

export function CommunityFormDialog({
  mode,
  role,
  organizationId,
  open,
  onOpenChange,
  onSaved,
  community,
}: Props) {
  const isCreate = mode === "create";
  const isAdmin = role === "ADMIN";
  // O seletor só existe para ADMIN criando uma comunidade: a organização
  // de uma comunidade existente não é editável (PUT /communities/{id} só
  // aceita `name`) e o MANAGER nunca escolhe organização.
  const showOrganizationSelect = isCreate && isAdmin;

  const [values, setValues] = useState<FormValues>(EMPTY);
  const [initialValues, setInitialValues] = useState<FormValues>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loadingOrganizations, setLoadingOrganizations] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFormError(null);
    setFieldErrors({});
    if (mode === "edit" && community) {
      const next: FormValues = {
        name: community.name,
        organizationId: community.organization.id,
      };
      setValues(next);
      setInitialValues(next);
    } else {
      setValues(EMPTY);
      setInitialValues(EMPTY);
    }
  }, [open, mode, community]);

  useEffect(() => {
    if (!open || !showOrganizationSelect) return;
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingOrganizations(true);
    listOrganizations()
      .then((list) => {
        if (active) setOrganizations(list);
      })
      .catch(() => {
        if (active) setFormError("Não foi possível carregar as organizações.");
      })
      .finally(() => {
        if (active) setLoadingOrganizations(false);
      });
    return () => {
      active = false;
    };
  }, [open, showOrganizationSelect]);

  const isDirty = useMemo(() => {
    if (mode !== "edit") return true;
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

  function handleNameBlur() {
    const error = validateName(values);
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (error) next.name = error;
      else delete next.name;
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const clientErrors = validateAll(values, showOrganizationSelect);
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      return;
    }

    // Para quem não é ADMIN, a organização vem pronta do pai — sem
    // fallback para escolha manual (decisão D3).
    const targetOrganizationId = isAdmin
      ? values.organizationId
      : (organizationId ?? "");
    if (isCreate && !targetOrganizationId) {
      setFormError(
        "Não foi possível identificar a sua organização. Recarregue a página e tente novamente.",
      );
      return;
    }

    setSubmitting(true);
    try {
      const payload = { name: values.name.trim() };
      if (isCreate) {
        await createCommunity(targetOrganizationId, payload);
      } else if (community) {
        await updateCommunity(community.id, payload);
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError) {
        const apiFieldErrors = parseCommunityFieldErrors(err.payload);
        if (Object.keys(apiFieldErrors).length > 0) {
          setFieldErrors(apiFieldErrors);
        }
        setFormError(err.message);
      } else {
        setFormError("Não foi possível salvar a comunidade.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const title = isCreate ? "Nova comunidade" : "Editar comunidade";
  const description = isCreate
    ? "Cadastre uma nova comunidade."
    : "Atualize os dados da comunidade selecionada.";

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

          {!isCreate && community && (
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
              <p className="text-xs text-muted-foreground">Organização</p>
              <p className="font-medium text-foreground">
                {community.organization.name}
              </p>
            </div>
          )}

          {showOrganizationSelect && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="community-organization">Organização</Label>
              <Select
                value={values.organizationId}
                onValueChange={(value) =>
                  update("organizationId", value ?? "")
                }
                disabled={submitting || loadingOrganizations}
              >
                <SelectTrigger id="community-organization" className="w-full">
                  <SelectValue
                    placeholder={
                      loadingOrganizations
                        ? "Carregando…"
                        : "Selecione a organização"
                    }
                  >
                    {(value) =>
                      organizations.find((org) => org.id === value)?.name ??
                      "Selecione a organização"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.organizationId && (
                <p className="text-sm text-destructive">
                  {fieldErrors.organizationId}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="community-name">Nome da comunidade</Label>
            <Input
              id="community-name"
              value={values.name}
              onChange={(e) => update("name", e.target.value)}
              onBlur={handleNameBlur}
              disabled={submitting}
              aria-invalid={Boolean(fieldErrors.name)}
            />
            {fieldErrors.name && (
              <p className="text-sm text-destructive">{fieldErrors.name}</p>
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
