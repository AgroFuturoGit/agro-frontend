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
import { deleteProductionPlan, type ProductionPlan } from "@/lib/production";

type Props = {
  plan: ProductionPlan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
};

export function DeletePlanDialog({
  plan,
  open,
  onOpenChange,
  onDeleted,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!plan) return;
    setError(null);
    setSubmitting(true);
    try {
      await deleteProductionPlan(plan.id);
      onDeleted();
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível excluir o plano.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir plano de produção</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação removerá o plano{" "}
            <span className="font-medium text-foreground">
              {plan?.crop ? `${plan.crop.name} — ${plan.crop.variety}` : ""}
            </span>{" "}
            e todos os apontamentos vinculados. Não é possível desfazer.
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
