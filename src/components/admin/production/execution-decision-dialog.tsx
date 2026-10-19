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
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { unitLabel, type MeasurementUnit } from "@/lib/crops";
import {
  formatNumber,
  formatPlanDate,
  rejectProductionExecution,
  validateProductionExecution,
  type ProductionExecution,
} from "@/lib/production";

export type DecisionMode = "validate" | "reject";

type Props = {
  mode: DecisionMode;
  execution: ProductionExecution | null;
  /** Unidade da cultura do plano, para exibir a quantidade (ex.: "12 caixas"). */
  unit?: MeasurementUnit | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Chamado após o back aceitar a decisão (a tela recarrega os dados). */
  onDecided: () => void;
};

const MAX_REASON_LENGTH = 500;

/**
 * Decisão sobre um apontamento pendente: "Validar" pede só confirmação;
 * "Rejeitar" aceita um motivo OPCIONAL (segue o back). Erros da API ficam no
 * dialog, que não fecha.
 */
export function ExecutionDecisionDialog({
  mode,
  execution,
  unit = null,
  open,
  onOpenChange,
  onDecided,
}: Props) {
  const isReject = mode === "reject";
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReason("");
    setError(null);
  }, [open, execution?.id, mode]);

  async function handleConfirm() {
    if (!execution) return;
    setError(null);
    setSubmitting(true);
    try {
      if (isReject) {
        await rejectProductionExecution(execution.id, reason);
      } else {
        await validateProductionExecution(execution.id);
      }
      onDecided();
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : isReject
            ? "Não foi possível rejeitar o apontamento."
            : "Não foi possível validar o apontamento.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const title = isReject ? "Rejeitar apontamento" : "Validar apontamento";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {isReject ? "Rejeitar" : "Validar"} o apontamento de{" "}
            <span className="font-medium text-foreground">
              {formatPlanDate(execution?.harvestedAt)}
            </span>
            {execution && (
              <>
                {" "}
                ({formatNumber(execution.quantity)}{" "}
                {unitLabel(unit, execution.quantity)})
              </>
            )}
            .{" "}
            {isReject
              ? "Ele deixa de contar no realizado e o agricultor poderá corrigi-lo."
              : "Ele passa a contar no realizado da produção."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {isReject && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="execution-rejection-reason">Motivo (opcional)</Label>
            <textarea
              id="execution-rejection-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={MAX_REASON_LENGTH}
              rows={3}
              disabled={submitting}
              className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 md:text-sm dark:bg-input/30"
            />
          </div>
        )}

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
            variant={isReject ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="animate-spin" />
                {isReject ? "Rejeitando…" : "Validando…"}
              </>
            ) : isReject ? (
              "Rejeitar"
            ) : (
              "Validar"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
