"use client";

import { useEffect, useMemo, useState } from "react";
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
import { cn } from "@/lib/utils";
import { formatCpf, isValidCpf } from "@/lib/cpf";
import { TEXT_MAX_LENGTH, isValidEmail, onlyDigits } from "@/lib/validation";
import {
  parseProducerRegisterFieldErrors,
  registerProducer,
  type Community,
  type ProducerRegisterPayload,
} from "@/lib/communities";
import {
  producerDisplayName,
  updateProducer,
  type Producer,
  type ProducerUpdatePayload,
} from "@/lib/producers";

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
  motherName: string;
  phone: string;
  educationLevel: string;
  origin: string;
  localName: string;
  street: string;
  city: string;
  state: string;
  ibgeCode: string;
  latitude: string;
  longitude: string;
  communityId: string;
};

const EMPTY: FormValues = {
  fullName: "",
  email: "",
  password: "",
  cpf: "",
  dateOfBirth: "",
  motherName: "",
  phone: "",
  educationLevel: "",
  origin: "",
  localName: "",
  street: "",
  city: "",
  state: "",
  ibgeCode: "",
  latitude: "",
  longitude: "",
  communityId: "",
};

/** Campos de texto livre que seguem a regra "vazio = limpa" na edição (BR-005). */
const TEXT_FIELDS = [
  "motherName",
  "phone",
  "educationLevel",
  "origin",
  "localName",
  "street",
  "city",
  "state",
  "ibgeCode",
] as const;

const CANNOT_CLEAR_MESSAGE =
  "Não é possível remover este valor depois de definido; altere para outro valor";

function parseCoordinate(value: string): number | null {
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) return null;
  const number = Number(trimmed);
  return Number.isFinite(number) ? number : Number.NaN;
}

function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function validateField(
  field: keyof FormValues,
  values: FormValues,
  mode: Mode,
  original: Producer | null | undefined,
): string | null {
  switch (field) {
    case "fullName":
      return values.fullName.trim() ? null : "Informe o nome completo";
    case "email":
      if (mode !== "create") return null;
      if (!values.email.trim()) return "Informe o e-mail";
      return isValidEmail(values.email) ? null : "Informe um e-mail válido";
    case "password":
      if (mode !== "create") return null;
      if (!values.password) return "Informe a senha";
      if (values.password.length < 8) {
        return "A senha deve ter no mínimo 8 caracteres";
      }
      return null;
    case "cpf":
      if (mode !== "create") return null;
      if (!values.cpf.trim()) return "Informe o CPF";
      return isValidCpf(values.cpf) ? null : "CPF inválido";
    case "communityId":
      if (mode !== "create") return null;
      return values.communityId ? null : "Selecione a comunidade do agricultor";
    case "dateOfBirth":
      if (!values.dateOfBirth) {
        return mode === "edit" && original?.dateOfBirth
          ? CANNOT_CLEAR_MESSAGE
          : null;
      }
      return values.dateOfBirth > todayIso()
        ? "A data de nascimento não pode ser futura"
        : null;
    case "state":
      if (!values.state.trim()) return null;
      // Valor legado inalterado não trava a edição.
      if (mode === "edit" && values.state === (original?.state ?? "")) {
        return null;
      }
      return /^[A-Za-z]{2}$/.test(values.state.trim())
        ? null
        : "Informe a UF com 2 letras";
    case "ibgeCode":
      if (!values.ibgeCode.trim()) return null;
      if (mode === "edit" && values.ibgeCode === (original?.ibgeCode ?? "")) {
        return null;
      }
      return /^\d{7}$/.test(values.ibgeCode.trim())
        ? null
        : "O código IBGE deve ter 7 dígitos";
    case "latitude":
    case "longitude": {
      const isLat = field === "latitude";
      const limit = isLat ? 90 : 180;
      const label = isLat ? "A latitude" : "A longitude";
      const own = parseCoordinate(values[field]);
      const other = parseCoordinate(values[isLat ? "longitude" : "latitude"]);
      if (own === null) {
        if (mode === "edit" && (isLat ? original?.latitude : original?.longitude) != null) {
          return CANNOT_CLEAR_MESSAGE;
        }
        return other !== null && !Number.isNaN(other)
          ? `Informe ${isLat ? "a latitude" : "a longitude"} junto com ${isLat ? "a longitude" : "a latitude"}`
          : null;
      }
      if (Number.isNaN(own)) return `${label} deve ser um número`;
      if (own < -limit || own > limit) {
        return `${label} deve estar entre -${limit} e ${limit}`;
      }
      return null;
    }
    default:
      return null;
  }
}

function validateAll(
  values: FormValues,
  mode: Mode,
  original: Producer | null | undefined,
): Record<string, string> {
  const errors: Record<string, string> = {};
  (Object.keys(values) as (keyof FormValues)[]).forEach((field) => {
    const error = validateField(field, values, mode, original);
    if (error) errors[field] = error;
  });
  return errors;
}

type FieldProps = {
  id: string;
  label: string;
  error?: string;
  /** Use `sm:col-span-2` para ocupar a linha inteira da grade. */
  className?: string;
  children: React.ReactNode;
};

function Field({ id, label, error, className, children }: FieldProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 border-t pt-6 first-of-type:border-t-0 first-of-type:pt-0">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

const FULL_ROW = "sm:col-span-2";

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
  const [initialValues, setInitialValues] = useState<FormValues>(EMPTY);
  const [isCompliant, setIsCompliant] = useState(false);
  const [initialCompliant, setInitialCompliant] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFieldErrors({});
    setFormError(null);
    if (mode === "edit" && producer) {
      const next: FormValues = {
        ...EMPTY,
        fullName: producerDisplayName(producer, ""),
        email: producer.user?.email ?? "",
        cpf: producer.cpf ?? producer.user?.cpf ?? "",
        dateOfBirth: producer.dateOfBirth ?? "",
        motherName: producer.motherName ?? "",
        phone: producer.phone ?? "",
        educationLevel: producer.educationLevel ?? "",
        origin: producer.origin ?? "",
        localName: producer.localName ?? "",
        street: producer.street ?? "",
        city: producer.city ?? "",
        state: producer.state ?? "",
        ibgeCode: producer.ibgeCode ?? "",
        latitude: producer.latitude != null ? String(producer.latitude) : "",
        longitude: producer.longitude != null ? String(producer.longitude) : "",
        communityId: producer.community?.id ?? "",
      };
      setValues(next);
      setInitialValues(next);
      setIsCompliant(producer.isCompliant ?? false);
      setInitialCompliant(producer.isCompliant ?? false);
    } else {
      setValues(EMPTY);
      setInitialValues(EMPTY);
      setIsCompliant(false);
      setInitialCompliant(false);
    }
  }, [open, mode, producer]);

  // Na edição, "Salvar alterações" só habilita quando algo mudou.
  const isDirty = useMemo(() => {
    if (mode !== "edit") return true;
    if (isCompliant !== initialCompliant) return true;
    return (Object.keys(values) as (keyof FormValues)[]).some(
      (key) => values[key].trim() !== initialValues[key].trim(),
    );
  }, [mode, values, initialValues, isCompliant, initialCompliant]);

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
    const error = validateField(field, values, mode, producer);
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (error) next[field] = error;
      else delete next[field];
      return next;
    });
  }

  function buildRegisterPayload(): ProducerRegisterPayload {
    const payload: ProducerRegisterPayload = {
      fullName: values.fullName.trim(),
      cpf: onlyDigits(values.cpf),
      email: values.email.trim(),
      password: values.password,
    };
    if (values.dateOfBirth) payload.dateOfBirth = values.dateOfBirth;
    for (const field of TEXT_FIELDS) {
      const value = values[field].trim();
      if (value) payload[field] = field === "state" ? value.toUpperCase() : value;
    }
    const latitude = parseCoordinate(values.latitude);
    const longitude = parseCoordinate(values.longitude);
    if (latitude !== null && longitude !== null) {
      payload.latitude = latitude;
      payload.longitude = longitude;
    }
    return payload;
  }

  function buildUpdatePayload(original: Producer): ProducerUpdatePayload {
    const payload: ProducerUpdatePayload = {
      fullName: values.fullName.trim(),
      isCompliant,
      // `null` = manter no back; datas/GPS já definidos não podem ser limpos.
      dateOfBirth: values.dateOfBirth || null,
      latitude: parseCoordinate(values.latitude),
      longitude: parseCoordinate(values.longitude),
    };
    for (const field of TEXT_FIELDS) {
      const value = values[field].trim();
      const normalized = field === "state" ? value.toUpperCase() : value;
      // Esvaziar um valor existente envia "" (limpa); campo que já era
      // vazio continua `null` (mantém).
      payload[field] = normalized || (original[field] ? "" : null);
    }
    return payload;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const clientErrors = validateAll(values, mode, producer);
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "create") {
        // `communityId` é path param — nunca vai no corpo.
        // `isCompliant` não é enviável na criação.
        await registerProducer(values.communityId, buildRegisterPayload());
      } else if (producer) {
        await updateProducer(producer.id, buildUpdatePayload(producer));
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
      <SheetContent side="right" className="data-[side=right]:sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col overflow-y-auto"
        >
          <div className="flex flex-1 flex-col gap-6 px-4 pb-6">
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

            <Section title="Comunidade">
              {isCreate ? (
                <Field
                  id="producer-community"
                  label="Comunidade"
                  error={fieldErrors.communityId}
                  className={FULL_ROW}
                >
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
                </Field>
              ) : (
                <Field
                  id="producer-community-readonly"
                  label="Comunidade"
                  className={FULL_ROW}
                >
                  <Input
                    id="producer-community-readonly"
                    value={producer?.community?.name ?? "—"}
                    readOnly
                    disabled
                  />
                </Field>
              )}
            </Section>

            <Section title="Dados pessoais">
              <Field
                id="producer-full-name"
                label="Nome completo"
                error={fieldErrors.fullName}
                className={FULL_ROW}
              >
                <Input
                  id="producer-full-name"
                  maxLength={TEXT_MAX_LENGTH}
                  value={values.fullName}
                  onChange={(e) => update("fullName", e.target.value)}
                  onBlur={() => handleBlur("fullName")}
                  required
                  disabled={submitting}
                  autoComplete="name"
                  aria-invalid={Boolean(fieldErrors.fullName)}
                />
              </Field>

              {isCreate ? (
                <Field id="producer-cpf" label="CPF" error={fieldErrors.cpf}>
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
                </Field>
              ) : (
                <Field id="producer-cpf-readonly" label="CPF">
                  <Input
                    id="producer-cpf-readonly"
                    value={formatCpf(values.cpf)}
                    readOnly
                    disabled
                  />
                </Field>
              )}

              <Field
                id="producer-date-of-birth"
                label="Data de nascimento"
                error={fieldErrors.dateOfBirth}
              >
                <Input
                  id="producer-date-of-birth"
                  type="date"
                  value={values.dateOfBirth}
                  onChange={(e) => update("dateOfBirth", e.target.value)}
                  onBlur={() => handleBlur("dateOfBirth")}
                  disabled={submitting}
                  aria-invalid={Boolean(fieldErrors.dateOfBirth)}
                />
              </Field>

              <Field
                id="producer-mother-name"
                label="Nome da mãe"
                className={FULL_ROW}
              >
                <Input
                  id="producer-mother-name"
                  maxLength={TEXT_MAX_LENGTH}
                  value={values.motherName}
                  onChange={(e) => update("motherName", e.target.value)}
                  disabled={submitting}
                />
              </Field>

              <Field id="producer-phone" label="Telefone">
                <Input
                  id="producer-phone"
                  maxLength={TEXT_MAX_LENGTH}
                  type="tel"
                  value={values.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  disabled={submitting}
                  autoComplete="tel"
                />
              </Field>

              <Field id="producer-education-level" label="Escolaridade">
                <Input
                  id="producer-education-level"
                  maxLength={TEXT_MAX_LENGTH}
                  value={values.educationLevel}
                  onChange={(e) => update("educationLevel", e.target.value)}
                  disabled={submitting}
                />
              </Field>

              <Field id="producer-origin" label="Origem" className={FULL_ROW}>
                <Input
                  id="producer-origin"
                  maxLength={TEXT_MAX_LENGTH}
                  value={values.origin}
                  onChange={(e) => update("origin", e.target.value)}
                  disabled={submitting}
                />
              </Field>
            </Section>

            <Section title="Acesso">
              {isCreate ? (
                <>
                  <Field id="producer-email" label="E-mail" error={fieldErrors.email}>
                    <Input
                      id="producer-email"
                      maxLength={TEXT_MAX_LENGTH}
                      type="email"
                      value={values.email}
                      onChange={(e) => update("email", e.target.value)}
                      onBlur={() => handleBlur("email")}
                      required
                      disabled={submitting}
                      autoComplete="email"
                      aria-invalid={Boolean(fieldErrors.email)}
                    />
                  </Field>

                  <Field
                    id="producer-password"
                    label="Senha"
                    error={fieldErrors.password}
                  >
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
                  </Field>
                </>
              ) : (
                <Field
                  id="producer-email-readonly"
                  label="E-mail"
                  className={FULL_ROW}
                >
                  <Input
                    id="producer-email-readonly"
                    value={values.email}
                    readOnly
                    disabled
                  />
                </Field>
              )}
            </Section>

            <Section title="Endereço">
              <Field
                id="producer-local-name"
                label="Endereço/Nome local"
                className={FULL_ROW}
              >
                <Input
                  id="producer-local-name"
                  maxLength={TEXT_MAX_LENGTH}
                  value={values.localName}
                  onChange={(e) => update("localName", e.target.value)}
                  disabled={submitting}
                  placeholder="Como o local é conhecido"
                />
              </Field>

              <Field id="producer-street" label="Rua" className={FULL_ROW}>
                <Input
                  id="producer-street"
                  maxLength={TEXT_MAX_LENGTH}
                  value={values.street}
                  onChange={(e) => update("street", e.target.value)}
                  disabled={submitting}
                />
              </Field>

              <div
                className={cn(
                  FULL_ROW,
                  "grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_5rem_9rem]",
                )}
              >
                <Field id="producer-city" label="Cidade">
                  <Input
                    id="producer-city"
                    maxLength={TEXT_MAX_LENGTH}
                    value={values.city}
                    onChange={(e) => update("city", e.target.value)}
                    disabled={submitting}
                  />
                </Field>

                <Field id="producer-state" label="UF" error={fieldErrors.state}>
                  <Input
                    id="producer-state"
                    value={values.state}
                    onChange={(e) => update("state", e.target.value.toUpperCase())}
                    onBlur={() => handleBlur("state")}
                    maxLength={2}
                    placeholder="AL"
                    disabled={submitting}
                    aria-invalid={Boolean(fieldErrors.state)}
                  />
                </Field>

                <Field
                  id="producer-ibge-code"
                  label="Código IBGE"
                  error={fieldErrors.ibgeCode}
                >
                  <Input
                    id="producer-ibge-code"
                    value={values.ibgeCode}
                    onChange={(e) =>
                      update("ibgeCode", e.target.value.replace(/\D/g, "").slice(0, 7))
                    }
                    onBlur={() => handleBlur("ibgeCode")}
                    inputMode="numeric"
                    maxLength={7}
                    placeholder="0000000"
                    disabled={submitting}
                    aria-invalid={Boolean(fieldErrors.ibgeCode)}
                  />
                </Field>
              </div>
            </Section>

            <Section title="Localização">
              <Field id="producer-latitude" label="Latitude" error={fieldErrors.latitude}>
                <Input
                  id="producer-latitude"
                  value={values.latitude}
                  onChange={(e) => update("latitude", e.target.value)}
                  onBlur={() => handleBlur("latitude")}
                  inputMode="decimal"
                  placeholder="-9.665"
                  disabled={submitting}
                  aria-invalid={Boolean(fieldErrors.latitude)}
                />
              </Field>

              <Field
                id="producer-longitude"
                label="Longitude"
                error={fieldErrors.longitude}
              >
                <Input
                  id="producer-longitude"
                  value={values.longitude}
                  onChange={(e) => update("longitude", e.target.value)}
                  onBlur={() => handleBlur("longitude")}
                  inputMode="decimal"
                  placeholder="-35.735"
                  disabled={submitting}
                  aria-invalid={Boolean(fieldErrors.longitude)}
                />
              </Field>

              {!isCreate && (
                <div className={cn(FULL_ROW, "flex items-center gap-2")}>
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
            </Section>
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
            <Button type="submit" disabled={submitting || !isDirty}>
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
