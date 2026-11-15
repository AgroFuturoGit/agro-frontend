import { EmptyValue } from "@/components/admin/empty-value";
import { Badge } from "@/components/ui/badge";
import {
  EXECUTION_STATUS_LABELS,
  formatPlanDate,
  type ExecutionStatus,
} from "@/lib/production";
import { EXECUTION_STATUS_VARIANT } from "@/lib/status-variants";

type Props = {
  status: ExecutionStatus | null;
  /** Motivo informado ao rejeitar — só é mostrado quando o status é REJECTED. */
  rejectionReason?: string | null;
  /** Momento da decisão (`validatedAt`) — mostrado em VALIDATED e REJECTED. */
  decidedAt?: string | null;
};

/**
 * Status de validação do apontamento — somente exibição (sem ações). Badge
 * semântico (pendente = atenção, validado = sucesso, rejeitado = erro) com
 * `data-status`; mostra, quando existem, o motivo da rejeição e a data da
 * decisão.
 */
export function ExecutionStatusBadge({
  status,
  rejectionReason = null,
  decidedAt = null,
}: Props) {
  if (!status) {
    return <EmptyValue />;
  }

  const reason = status === "REJECTED" ? rejectionReason?.trim() : null;
  const decided = status !== "PENDING" && decidedAt ? decidedAt : null;

  return (
    <div className="flex flex-col items-start gap-1">
      <Badge data-status={status} variant={EXECUTION_STATUS_VARIANT[status]}>
        {EXECUTION_STATUS_LABELS[status]}
      </Badge>
      {decided && (
        <span className="text-xs text-muted-foreground tabular-nums">
          Decidido em {formatPlanDate(decided)}
        </span>
      )}
      {reason && (
        <span className="max-w-64 text-xs whitespace-normal text-muted-foreground">
          Motivo: {reason}
        </span>
      )}
    </div>
  );
}
