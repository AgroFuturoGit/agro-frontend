"use client";

import { useEffect, useState } from "react";
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
import { persistSession, readUserFromStorage, type Role } from "@/lib/auth";
import { formatCpf } from "@/lib/cpf";
import {
  CREATABLE_ROLES,
  ROLE_LABELS,
  ROLES,
  adminUpdateUser,
  registerUser,
  type User,
} from "@/lib/users";

type Mode = "create" | "edit";

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
  dateOfBirth: "",
  role: "ADMIN" as Role,
};

export function UserFormDialog({
  mode,
  open,
  onOpenChange,
  onSaved,
  user,
}: Props) {
  const [values, setValues] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null);
    if (mode === "edit" && user) {
      setValues({
        ...EMPTY,
        fullName: user.fullName,
        email: user.email,
        cpf: user.cpf,
        dateOfBirth: user.dateOfBirth ?? "",
        role: user.role,
      });
    } else {
      setValues(EMPTY);
    }
  }, [open, mode, user]);

  function update<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "create") {
        await registerUser({
          fullName: values.fullName.trim(),
          email: values.email.trim(),
          password: values.password,
          cpf: values.cpf.trim(),
          dateOfBirth: values.dateOfBirth,
          role: values.role,
        });
      } else if (user) {
        const updated = await adminUpdateUser(user.id, {
          fullName: values.fullName.trim(),
          dateOfBirth: values.dateOfBirth,
          role: values.role,
        });
        const stored = readUserFromStorage();
        if (stored && stored.id === user.id) {
          const token =
            typeof document !== "undefined"
              ? (document.cookie.match(/(?:^|; )agro_token=([^;]*)/)?.[1] ?? null)
              : null;
          if (token) {
            persistSession({
              token: decodeURIComponent(token),
              userResponseDTO: { ...stored, ...updated },
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
  const title = isCreate ? "Novo usuário" : "Editar usuário";
  const description = isCreate
    ? "Cadastre um novo usuário do sistema."
    : "Atualize os dados do usuário selecionado.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  value={values.cpf}
                  onChange={(e) => update("cpf", formatCpf(e.target.value))}
                  required
                  inputMode="numeric"
                  maxLength={14}
                  placeholder="000.000.000-00"
                  disabled={submitting}
                />
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
            <Label htmlFor="dateOfBirth">Data de nascimento</Label>
            <Input
              id="dateOfBirth"
              type="date"
              value={values.dateOfBirth}
              onChange={(e) => update("dateOfBirth", e.target.value)}
              required
              disabled={submitting}
            />
          </div>

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
                {(isCreate ? CREATABLE_ROLES : ROLES).map((role) => (
                  <SelectItem key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isCreate && (
              <p className="text-xs text-muted-foreground">
                Gestores e Produtores não são criados aqui — use os fluxos de
                Organização e Comunidade.
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
                  Salvando…
                </>
              ) : isCreate ? (
                "Cadastrar"
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
