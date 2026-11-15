"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

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
import { InlineAlert } from "@/components/ui/inline-alert";
import { ApiError } from "@/lib/api";
import { deleteHarvest, type Harvest } from "@/lib/harvests";

type Props = {
  harvest: Harvest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
};

export function DeleteHarvestDialog({
  harvest,
  open,
  onOpenChange,
  onDeleted,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sempre que o diálogo abre, descarta o erro e o envio da abertura anterior.
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null);
    setSubmitting(false);
  }, [open]);

  async function handleConfirm() {
    if (!harvest) return;
    setError(null);
    setSubmitting(true);
    try {
      await deleteHarvest(harvest.id);
      onDeleted();
      onOpenChange(false);
    } catch (err) {
      // Registro já removido: recarrega a lista para refletir o estado real.
      if (err instanceof ApiError && err.status === 404) onDeleted();
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível excluir a safra.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir safra</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação removerá{" "}
            <span className="font-medium text-foreground">
              {harvest?.label ?? "a safra"}
            </span>{" "}
            do sistema. Não é possível desfazer.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && (
          <InlineAlert variant="destructive">{error}</InlineAlert>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
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
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
