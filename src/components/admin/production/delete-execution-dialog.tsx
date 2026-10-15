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
import { unitLabel, type MeasurementUnit } from "@/lib/crops";
import {
  deleteProductionExecution,
  formatNumber,
  formatPlanDate,
  type ProductionExecution,
} from "@/lib/production";

type Props = {
  execution: ProductionExecution | null;
  /** Unidade da cultura do plano, para exibir a quantidade (ex.: "12 caixas"). */
  unit?: MeasurementUnit | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
};

export function DeleteExecutionDialog({
  execution,
  unit = null,
  open,
  onOpenChange,
  onDeleted,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!execution) return;
    setError(null);
    setSubmitting(true);
    try {
      await deleteProductionExecution(execution.id);
      onDeleted();
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível excluir o apontamento.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir apontamento</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação removerá o apontamento de{" "}
            <span className="font-medium text-foreground">
              {formatPlanDate(execution?.harvestedAt)}
            </span>
            {execution && (
              <>
                {" "}
                (
                {formatNumber(execution.quantity)}{" "}
                {unitLabel(unit, execution.quantity)})
              </>
            )}{" "}
            do histórico de colheita. Não é possível desfazer.
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
