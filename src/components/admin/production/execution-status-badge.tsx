import { cn } from "@/lib/utils";
import {
  EXECUTION_STATUS_LABELS,
  formatPlanDate,
  type ExecutionStatus,
} from "@/lib/production";

type Props = {
  status: ExecutionStatus | null;
  /** Motivo informado ao rejeitar — só é mostrado quando o status é REJECTED. */
  rejectionReason?: string | null;
  /** Momento da decisão (`validatedAt`) — mostrado em VALIDATED e REJECTED. */
  decidedAt?: string | null;
};

const STYLES: Record<ExecutionStatus, string> = {
  PENDING: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  VALIDATED: "bg-primary/10 text-primary",
  REJECTED: "bg-destructive/10 text-destructive",
};

/**
 * Status de validação do apontamento — somente exibição (sem ações). Mostra,
 * quando existem, o motivo da rejeição e a data da decisão.
 */
export function ExecutionStatusBadge({
  status,
  rejectionReason = null,
  decidedAt = null,
}: Props) {
  if (!status) {
    return <span className="text-muted-foreground">—</span>;
  }

  const reason = status === "REJECTED" ? rejectionReason?.trim() : null;
  const decided = status !== "PENDING" && decidedAt ? decidedAt : null;

  return (
    <div className="flex flex-col items-start gap-0.5">
      <span
        data-status={status}
        className={cn(
          "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
          STYLES[status],
        )}
      >
        {EXECUTION_STATUS_LABELS[status]}
      </span>
      {decided && (
        <span className="text-xs text-muted-foreground">
          Decidido em {formatPlanDate(decided)}
        </span>
      )}
      {reason && (
        <span className="max-w-64 text-xs text-muted-foreground">
          Motivo: {reason}
        </span>
      )}
    </div>
  );
}
