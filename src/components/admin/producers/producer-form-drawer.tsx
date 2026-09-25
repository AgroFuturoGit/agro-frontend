"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api";
import { formatCpf } from "@/lib/cpf";
import {
  parseProducerRegisterFieldErrors,
  registerProducer,
  type Community,
} from "@/lib/communities";
import { updateProducer, type Producer } from "@/lib/producers";

type Mode = "create" | "edit";

type Props = {
  mode: Mode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Chamado após salvar com sucesso, para o pai recarregar a lista. */
  onSaved: () => void;
  producer?: Producer | null;
  /**
   * Comunidades já resolvidas e filtradas pela página pai (decisão D2/D3).
   * Este drawer NUNCA busca comunidades nem resolve a organização do
   * usuário logado por conta própria — o backend não impõe escopo
   * hierárquico, então o escopo é sempre responsabilidade de quem monta
   * a lista. Só é usado no modo `create`.
   */
  communities?: Community[];
  loadingCommunities?: boolean;
};

type FormValues = {
  fullName: string;
  email: string;
  password: string;
  cpf: string;
  dateOfBirth: string;
  aliasName: string;
  communityId: string;
};

const EMPTY: FormValues = {
  fullName: "",
  email: "",
  password: "",
  cpf: "",
  dateOfBirth: "",
  aliasName: "",
  communityId: "",
};

function validateField(
  field: keyof FormValues,
  values: FormValues,
): string | null {
  // Único campo opcional do `ProducerRegisterDTO`.
  if (field === "aliasName") return null;

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
      case "communityId":
        return "Selecione a comunidade do agricultor";
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

export function ProducerFormDrawer({
  mode,
  open,
  onOpenChange,
  onSaved,
  producer,
  communities = [],
  loadingCommunities = false,
}: Props) {
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [isCompliant, setIsCompliant] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFieldErrors({});
    setFormError(null);
    if (mode === "edit" && producer) {
      setValues({
        ...EMPTY,
        fullName: producer.user?.fullName ?? "",
        email: producer.user?.email ?? "",
        cpf: producer.user?.cpf ?? "",
        aliasName: producer.aliasName ?? "",
        communityId: producer.community?.id ?? "",
      });
      setIsCompliant(producer.isCompliant ?? false);
    } else {
      setValues(EMPTY);
      setIsCompliant(false);
    }
  }, [open, mode, producer]);

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
    if (mode !== "create") return;
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

    if (mode === "create") {
      const clientErrors = validateAll(values);
      if (Object.keys(clientErrors).length > 0) {
        setFieldErrors(clientErrors);
        return;
      }
    }

    setSubmitting(true);
    try {
      const aliasName = values.aliasName.trim();
      if (mode === "create") {
        // `communityId` é path param — nunca vai no corpo.
        // `isCompliant` não é enviável na criação: o backend crava `true`.
        await registerProducer(values.communityId, {
          fullName: values.fullName.trim(),
          email: values.email.trim(),
          password: values.password,
          cpf: values.cpf.trim(),
          dateOfBirth: values.dateOfBirth,
          ...(aliasName ? { aliasName } : {}),
        });
      } else if (producer) {
        await updateProducer(producer.id, {
          aliasName: aliasName === "" ? null : aliasName,
          isCompliant,
        });
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError) {
        if (mode === "create") {
          const apiFieldErrors = parseProducerRegisterFieldErrors(err.payload);
          if (Object.keys(apiFieldErrors).length > 0) {
            setFieldErrors(apiFieldErrors);
          }
        }
        setFormError(err.message);
      } else {
        setFormError(
          mode === "create"
            ? "Não foi possível cadastrar o agricultor."
            : "Não foi possível salvar o agricultor.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  const isCreate = mode === "create";
  const title = isCreate ? "Novo agricultor" : "Editar agricultor";
  const description = isCreate
    ? "Cadastre um agricultor vinculado a uma comunidade."
    : "Atualize os dados do agricultor selecionado.";

  const communityPlaceholder = loadingCommunities
    ? "Carregando…"
    : communities.length === 0
      ? "Nenhuma comunidade disponível"
      : "Selecione a comunidade";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

        <form
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

            {isCreate ? (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="producer-community">Comunidade</Label>
                  <Select
                    value={values.communityId}
                    onValueChange={(value) => update("communityId", value ?? "")}
                    disabled={submitting || loadingCommunities}
                  >
                    <SelectTrigger
                      id="producer-community"
                      className="w-full"
                      aria-invalid={Boolean(fieldErrors.communityId)}
                    >
                      <SelectValue placeholder={communityPlaceholder}>
                        {(value) =>
                          communities.find((item) => item.id === value)?.name ??
                          communityPlaceholder
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {communities.map((community) => (
                        <SelectItem key={community.id} value={community.id}>
                          {community.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldErrors.communityId && (
                    <p className="text-sm text-destructive">
                      {fieldErrors.communityId}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="producer-full-name">Nome completo</Label>
                  <Input
                    id="producer-full-name"
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
                  <Label htmlFor="producer-email">E-mail</Label>
                  <Input
                    id="producer-email"
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
                  <Label htmlFor="producer-password">Senha</Label>
                  <Input
                    id="producer-password"
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
                  <Label htmlFor="producer-cpf">CPF</Label>
                  <Input
                    id="producer-cpf"
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
                    <p className="text-sm text-destructive">{fieldErrors.cpf}</p>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="producer-date-of-birth">
                    Data de nascimento
                  </Label>
                  <Input
                    id="producer-date-of-birth"
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
              </>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="producer-community-readonly">Comunidade</Label>
                  <Input
                    id="producer-community-readonly"
                    value={producer?.community?.name ?? "—"}
                    readOnly
                    disabled
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="producer-full-name-readonly">
                    Nome completo
                  </Label>
                  <Input
                    id="producer-full-name-readonly"
                    value={values.fullName}
                    readOnly
                    disabled
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="producer-email-readonly">E-mail</Label>
                  <Input
                    id="producer-email-readonly"
                    value={values.email}
                    readOnly
                    disabled
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="producer-cpf-readonly">CPF</Label>
                  <Input
                    id="producer-cpf-readonly"
                    value={formatCpf(values.cpf)}
                    readOnly
                    disabled
                  />
                </div>
              </>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="producer-alias-name">
                Nome de exibição (opcional)
              </Label>
              <Input
                id="producer-alias-name"
                value={values.aliasName}
                onChange={(e) => update("aliasName", e.target.value)}
                disabled={submitting}
                placeholder="Como o agricultor é conhecido"
                aria-invalid={Boolean(fieldErrors.aliasName)}
              />
              {fieldErrors.aliasName && (
                <p className="text-sm text-destructive">
                  {fieldErrors.aliasName}
                </p>
              )}
            </div>

            {!isCreate && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="producer-is-compliant"
                  checked={isCompliant}
                  onCheckedChange={(checked) => setIsCompliant(checked === true)}
                  disabled={submitting}
                />
                <Label htmlFor="producer-is-compliant" className="font-normal">
                  Agricultor em conformidade
                </Label>
              </div>
            )}
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
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" />
                  Salvando…
                </>
              ) : isCreate ? (
                "Cadastrar"
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
