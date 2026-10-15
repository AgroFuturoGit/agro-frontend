import { cn } from "@/lib/utils";
import { EXECUTION_STATUS_LABELS, type ExecutionStatus } from "@/lib/production";

type Props = {
  status: ExecutionStatus | null;
};

const STYLES: Record<ExecutionStatus, string> = {
  PENDING: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  VALIDATED: "bg-primary/10 text-primary",
  REJECTED: "bg-destructive/10 text-destructive",
};

/** Status de validação do apontamento — somente exibição (sem ações). */
export function ExecutionStatusBadge({ status }: Props) {
  if (!status) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <span
      data-status={status}
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        STYLES[status],
      )}
    >
      {EXECUTION_STATUS_LABELS[status]}
    </span>
  );
}
