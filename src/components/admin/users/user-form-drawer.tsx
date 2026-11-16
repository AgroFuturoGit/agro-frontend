"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
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
import { ApiError, apiErrorMessage, parseFieldErrors } from "@/lib/api";
import { persistSession, readUserFromStorage, type Role } from "@/lib/auth";
import { formatCpf, isValidCpf } from "@/lib/cpf";
import {
  LIMITS,
  NAME_MIN_LENGTH_MESSAGE,
  isValidEmail,
  onlyDigits,
} from "@/lib/validation";
import {
  TECHNICIAN_REGISTRATION_TYPES,
  createTechnician,
  type TechnicianRegistrationType,
} from "@/lib/technicians";
import {
  CREATABLE_ROLES,
  ROLE_LABELS,
  ROLES,
  adminUpdateUser,
  registerUser,
  type User,
} from "@/lib/users";
import { useFieldValidation } from "@/lib/use-field-validation";

type Mode = "create" | "edit";

/** Papéis que podem ser destino de troca: não exigem perfil/cadastro próprio. */
const ROLES_WITHOUT_OWN_PROFILE: Role[] = ["ADMIN"];

type Props = {
  mode: Mode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  user?: User | null;
};

const EMPTY = {
  fullName: "",
  email: "",
  password: "",
  cpf: "",
  registrationType: "" as TechnicianRegistrationType | "",
  registrationNumber: "",
  specialty: "",
  role: "" as Role | "",
};

type Values = typeof EMPTY;
type Field = keyof Values;
type FieldErrors = Partial<Record<Field, string>>;

const FIELDS = Object.keys(EMPTY) as Field[];

/** Id da mensagem de erro do campo, para o `aria-describedby`. */
function errorId(field: Field) {
  return `${field}-error`;
}

/**
 * Regras do formulário. Tudo o que depende dos valores sai de `values`
 * (inclusive se é técnico), para o blur e a digitação usarem os valores atuais.
 */
function validate(values: Values, mode: Mode): FieldErrors {
  const errors: FieldErrors = {};
  const isTechnician = mode === "create" && values.role === "TECHNICIAN";
  const name = values.fullName.trim();
  if (name.length === 1) errors.fullName = NAME_MIN_LENGTH_MESSAGE;
  if (!values.role) errors.role = "Selecione o papel.";
  if (mode !== "create") return errors;
  if (!isValidEmail(values.email)) errors.email = "Informe um e-mail válido";
  const cpf = values.cpf.trim();
  if (isTechnician && !cpf) errors.cpf = "Informe o CPF";
  else if (cpf && !isValidCpf(cpf)) errors.cpf = "CPF inválido";
  if (isTechnician) {
    // O back grava o número do registro como obrigatório (coluna NOT NULL).
    if (!values.registrationType) {
      errors.registrationType = "Informe o tipo do registro";
    }
    if (!values.registrationNumber.trim()) {
      errors.registrationNumber = "Informe o número do registro";
    }
  }
  return errors;
}

/** Erros por campo do 400 do back, só dos campos deste formulário. */
function serverFieldErrors(payload: unknown): FieldErrors {
  const parsed = parseFieldErrors(payload);
  const errors: FieldErrors = {};
  for (const field of FIELDS) {
    if (parsed[field]) errors[field] = parsed[field];
  }
  return errors;
}

export function UserFormDrawer({
  mode,
  open,
  onOpenChange,
  onSaved,
  user,
}: Props) {
  const [values, setValues] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    errors: fieldErrors,
    onBlur,
    onChange,
    setErrors,
    reset,
  } = useFieldValidation<Field, Values>(
    (field, current) => validate(current, mode)[field],
  );

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null);
    reset();
    if (mode === "edit" && user) {
      setValues({
        ...EMPTY,
        fullName: user.fullName,
        email: user.email,
        cpf: user.cpf ?? "",
        role: user.role,
      });
    } else {
      setValues(EMPTY);
    }
  }, [open, mode, user, reset]);

  function update<K extends Field>(key: K, value: Values[K]) {
    const next = { ...values, [key]: value };
    setValues(next);
    onChange(key, next);
  }

  /**
   * Select: o blur do trigger dispara ao abrir a lista, antes da escolha,
   * então o campo é validado ao escolher (os outros erros locais também são
   * recalculados, como na digitação).
   */
  function choose<K extends Field>(key: K, value: Values[K]) {
    const next = { ...values, [key]: value };
    setValues(next);
    onChange(key, next);
    onBlur(key, next);
  }

  /** `aria-describedby` do campo: aponta para a mensagem só quando há erro. */
  function describedBy(field: Field) {
    return fieldErrors[field] ? errorId(field) : undefined;
  }

  const isTechnician = mode === "create" && values.role === "TECHNICIAN";

  const isDirty = useMemo(() => {
    if (mode !== "edit" || !user) return true;
    return (
      values.fullName.trim() !== user.fullName.trim() || values.role !== user.role
    );
  }, [mode, user, values.fullName, values.role]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const clientErrors = validate(values, mode);
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors, "client");
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "create" && isTechnician) {
        // Cria usuário e perfil de técnico; `POST /users/register` com
        // TECHNICIAN deixaria o usuário sem perfil (404 em /technicians/me).
        const registrationNumber = values.registrationNumber.trim();
        const specialty = values.specialty.trim();
        await createTechnician({
          fullName: values.fullName.trim(),
          email: values.email.trim(),
          password: values.password,
          cpf: onlyDigits(values.cpf),
          ...(values.registrationType
            ? { registrationType: values.registrationType }
            : {}),
          ...(registrationNumber ? { registrationNumber } : {}),
          ...(specialty ? { specialty } : {}),
        });
      } else if (mode === "create") {
        const cpf = onlyDigits(values.cpf);
        await registerUser({
          fullName: values.fullName.trim(),
          email: values.email.trim(),
          password: values.password,
          ...(cpf ? { cpf } : {}),
          role: values.role as Role,
        });
      } else if (user) {
        const updated = await adminUpdateUser(user.id, {
          fullName: values.fullName.trim(),
          role: values.role as Role,
        });
        const stored = readUserFromStorage();
        if (stored && stored.id === user.id) {
          const token =
            typeof document !== "undefined"
              ? (document.cookie.match(/(?:^|; )agro_token=([^;]*)/)?.[1] ??
                null)
              : null;
          if (token) {
            persistSession({
              token: decodeURIComponent(token),
              userResponseDTO: {
                ...stored,
                ...updated,
                cpf: updated.cpf ?? stored.cpf,
              },
            });
          }
        }
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError) {
        const apiFieldErrors = serverFieldErrors(err.payload);
        if (Object.keys(apiFieldErrors).length > 0) {
          setErrors(apiFieldErrors, "server");
        }
      }
      setError(
        apiErrorMessage(err, "Não foi possível salvar o usuário."),
      );
    } finally {
      setSubmitting(false);
    }
  }

  const isCreate = mode === "create";
  // Na edição, o papel só troca para os que não exigem cadastro próprio
  // (hoje só ADMIN); o papel atual do usuário continua listado.
  const roleOptions = isCreate
    ? CREATABLE_ROLES
    : ROLES.filter(
        (role) => role === user?.role || ROLES_WITHOUT_OWN_PROFILE.includes(role),
      );
  const title = isCreate ? "Novo usuário" : "Editar usuário";
  const description = isCreate
    ? "Cadastre um novo usuário do sistema."
    : "Atualize os dados do usuário selecionado.";

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
            {error && (
              <InlineAlert variant="destructive">{error}</InlineAlert>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="fullName">Nome completo</Label>
              <Input
                id="fullName"
                value={values.fullName}
                onChange={(e) => update("fullName", e.target.value)}
                required
                maxLength={LIMITS.FULL_NAME}
                disabled={submitting}
                autoComplete="name"
                onBlur={() => onBlur("fullName", values)}
                aria-invalid={Boolean(fieldErrors.fullName)}
                aria-describedby={describedBy("fullName")}
              />
              {fieldErrors.fullName && (
                <p id={errorId("fullName")} className="text-sm text-destructive">
                  {fieldErrors.fullName}
                </p>
              )}
            </div>

            {isCreate ? (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={values.email}
                    onChange={(e) => update("email", e.target.value)}
                    required
                    maxLength={LIMITS.EMAIL}
                    disabled={submitting}
                    autoComplete="email"
                    onBlur={() => onBlur("email", values)}
                    aria-invalid={Boolean(fieldErrors.email)}
                    aria-describedby={describedBy("email")}
                  />
                  {fieldErrors.email && (
                    <p id={errorId("email")} className="text-sm text-destructive">
                      {fieldErrors.email}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    maxLength={LIMITS.PASSWORD}
                    type="password"
                    value={values.password}
                    onChange={(e) => update("password", e.target.value)}
                    required
                    minLength={8}
                    disabled={submitting}
                    autoComplete="new-password"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="cpf">
                    {isTechnician ? "CPF" : "CPF (opcional)"}
                  </Label>
                  <Input
                    id="cpf"
                    value={values.cpf}
                    onChange={(e) => update("cpf", formatCpf(e.target.value))}
                    required={isTechnician}
                    inputMode="numeric"
                    maxLength={14}
                    placeholder="000.000.000-00"
                    disabled={submitting}
                    onBlur={() => onBlur("cpf", values)}
                    aria-invalid={Boolean(fieldErrors.cpf)}
                    aria-describedby={describedBy("cpf")}
                  />
                  {fieldErrors.cpf && (
                    <p id={errorId("cpf")} className="text-sm text-destructive">
                      {fieldErrors.cpf}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email-readonly">E-mail</Label>
                  <Input
                    id="email-readonly"
                    value={values.email}
                    readOnly
                    disabled
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="cpf-readonly">CPF</Label>
                  <Input
                    id="cpf-readonly"
                    value={formatCpf(values.cpf)}
                    readOnly
                    disabled
                  />
                </div>
              </>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="role">Papel</Label>
              <Select
                value={values.role || null}
                onValueChange={(v) => choose("role", v as Role)}
              >
                <SelectTrigger
                  id="role"
                  className="w-full"
                  aria-invalid={Boolean(fieldErrors.role)}
                  aria-describedby={describedBy("role")}
                >
                  <SelectValue placeholder="Selecione o papel">
                    {(v) =>
                      v ? (ROLE_LABELS[v as Role] ?? v) : "Selecione o papel"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.role && (
                <p id={errorId("role")} className="text-sm text-destructive">
                  {fieldErrors.role}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {isCreate
                  ? "Gestores e Agricultores não são criados aqui — use os fluxos de Organização e Comunidade."
                  : "Técnicos, gestores e agricultores têm cadastro próprio; para mudar para esses perfis, crie um novo cadastro."}
              </p>
            </div>

            {isTechnician && (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="registrationType">Tipo de registro</Label>
                  <Select
                    value={values.registrationType || "NONE"}
                    onValueChange={(v) =>
                      choose(
                        "registrationType",
                        v === "NONE" ? "" : (v as TechnicianRegistrationType),
                      )
                    }
                    disabled={submitting}
                  >
                    <SelectTrigger
                      id="registrationType"
                      className="w-full"
                      aria-invalid={Boolean(fieldErrors.registrationType)}
                      aria-describedby={describedBy("registrationType")}
                    >
                      <SelectValue placeholder="Não informar">
                        {(v) => (v && v !== "NONE" ? v : "Não informar")}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">Não informar</SelectItem>
                      {TECHNICIAN_REGISTRATION_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldErrors.registrationType && (
                    <p
                      id={errorId("registrationType")}
                      className="text-sm text-destructive"
                    >
                      {fieldErrors.registrationType}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="registrationNumber">Número do registro</Label>
                  <Input
                    id="registrationNumber"
                    value={values.registrationNumber}
                    onChange={(e) => update("registrationNumber", e.target.value)}
                    maxLength={LIMITS.REGISTRATION_NUMBER}
                    disabled={submitting}
                    onBlur={() => onBlur("registrationNumber", values)}
                    aria-invalid={Boolean(fieldErrors.registrationNumber)}
                    aria-describedby={describedBy("registrationNumber")}
                  />
                  {fieldErrors.registrationNumber && (
                    <p
                      id={errorId("registrationNumber")}
                      className="text-sm text-destructive"
                    >
                      {fieldErrors.registrationNumber}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="specialty">Especialidade</Label>
                  <Input
                    id="specialty"
                    value={values.specialty}
                    onChange={(e) => update("specialty", e.target.value)}
                    maxLength={LIMITS.SPECIALTY}
                    disabled={submitting}
                  />
                </div>
              </>
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
