"use client";

import { useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api";
import { persistSession, readUserFromStorage, type Role } from "@/lib/auth";
import { formatCpf, isValidCpf } from "@/lib/cpf";
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
  role: "ADMIN" as Role,
};

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null);
    setFieldErrors({});
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
  }, [open, mode, user]);

  function update<K extends keyof typeof values>(
    key: K,
    value: (typeof values)[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  const isTechnician = mode === "create" && values.role === "TECHNICIAN";

  function validate(): Record<string, string> {
    const errors: Record<string, string> = {};
    if (mode !== "create") return errors;
    const cpf = values.cpf.trim();
    if (isTechnician && !cpf) errors.cpf = "Informe o CPF";
    else if (cpf && !isValidCpf(cpf)) errors.cpf = "CPF inválido";
    if (isTechnician) {
      const hasType = Boolean(values.registrationType);
      const hasNumber = Boolean(values.registrationNumber.trim());
      if (hasType && !hasNumber) {
        errors.registrationNumber = "Informe o número do registro";
      }
      if (hasNumber && !hasType) {
        errors.registrationType = "Informe o tipo do registro";
      }
    }
    return errors;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const clientErrors = validate();
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
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
          cpf: values.cpf.trim(),
          ...(values.registrationType
            ? { registrationType: values.registrationType }
            : {}),
          ...(registrationNumber ? { registrationNumber } : {}),
          ...(specialty ? { specialty } : {}),
        });
      } else if (mode === "create") {
        const cpf = values.cpf.trim();
        await registerUser({
          fullName: values.fullName.trim(),
          email: values.email.trim(),
          password: values.password,
          ...(cpf ? { cpf } : {}),
          role: values.role,
        });
      } else if (user) {
        const updated = await adminUpdateUser(user.id, {
          fullName: values.fullName.trim(),
          role: values.role,
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
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível salvar o usuário.",
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
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="fullName">Nome completo</Label>
              <Input
                id="fullName"
                value={values.fullName}
                onChange={(e) => update("fullName", e.target.value)}
                required
                disabled={submitting}
                autoComplete="name"
              />
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
                    disabled={submitting}
                    autoComplete="email"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
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
                    aria-invalid={Boolean(fieldErrors.cpf)}
                  />
                  {fieldErrors.cpf && (
                    <p className="text-sm text-destructive">{fieldErrors.cpf}</p>
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
                value={values.role}
                onValueChange={(v) => update("role", v as Role)}
              >
                <SelectTrigger id="role" className="w-full">
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
                      update(
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
                    <p className="text-sm text-destructive">
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
                    disabled={submitting}
                    aria-invalid={Boolean(fieldErrors.registrationNumber)}
                  />
                  {fieldErrors.registrationNumber && (
                    <p className="text-sm text-destructive">
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
