"use client";

import { useState } from "react";
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

  async function handleConfirm() {
    if (!harvest) return;
    setError(null);
    setSubmitting(true);
    try {
      await deleteHarvest(harvest.id);
      onDeleted();
      onOpenChange(false);
    } catch (err) {
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
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
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
