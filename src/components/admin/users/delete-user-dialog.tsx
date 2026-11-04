"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ApiError } from "@/lib/api";
import { deleteTechnician, listTechnicians } from "@/lib/technicians";
import { deleteUser, type User } from "@/lib/users";

type Props = {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
};

/**
 * O back recusa (409) `DELETE /users/{id}` de quem tem perfil. O FARMER sai pela
 * comunidade e o MANAGER ainda não tem rota de exclusão.
 */
const BLOCKED_REASON: Partial<Record<User["role"], string>> = {
  FARMER:
    "Agricultores são excluídos na tela da comunidade, junto com o perfil de produtor.",
  MANAGER: "O sistema ainda não permite excluir gestores.",
};

/** O técnico sai pelo próprio perfil; usuário antigo sem perfil, pela rota de usuário. */
async function removeUser(user: User) {
  if (user.role === "TECHNICIAN") {
    const technicians = await listTechnicians();
    const profile = technicians.find((item) => item.user?.id === user.id);
    if (profile) return deleteTechnician(profile.id);
  }
  return deleteUser(user.id);
}

export function DeleteUserDialog({ user, open, onOpenChange, onDeleted }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blockedReason = user ? BLOCKED_REASON[user.role] : undefined;

  // Sempre que o diálogo abre, descarta o erro e o envio da abertura anterior.
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null);
    setSubmitting(false);
  }, [open]);

  async function handleConfirm() {
    if (!user) return;
    setError(null);
    setSubmitting(true);
    try {
      await removeUser(user);
      onDeleted();
      onOpenChange(false);
    } catch (err) {
      // Registro já removido: recarrega a lista para refletir o estado real.
      if (err instanceof ApiError && err.status === 404) onDeleted();
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível excluir o usuário.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir usuário</AlertDialogTitle>
          <AlertDialogDescription>
            {blockedReason ?? (
              <>
                Esta ação removerá{" "}
                <span className="font-medium text-foreground">
                  {user?.fullName ?? "o usuário"}
                </span>{" "}
                do sistema. Não é possível desfazer.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>
            {blockedReason ? "Fechar" : "Cancelar"}
          </AlertDialogCancel>
          {!blockedReason && (
            <AlertDialogAction
              variant="destructive"
              onClick={handleConfirm}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" />
                  Excluindo…
                </>
              ) : (
                "Excluir"
              )}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
