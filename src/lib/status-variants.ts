// Mapas de status do domínio → variante visual dos primitivos Badge/Progress.
// Centraliza a semântica de cor (verde = ok, laranja = atenção, vermelho =
// erro) para que as telas não usem cores cruas do Tailwind. O texto do status
// continua sendo o que comunica; a cor só reforça.
import type { BadgeVariant } from "@/components/ui/badge";
import type { ProgressVariant } from "@/components/ui/progress";
import type { ProgressStatus, WarningSeverity } from "@/lib/analytics";
import type { FinancingStatus } from "@/lib/farmer-social";
import type { OccurrenceType } from "@/lib/occurrences";
import type { ExecutionStatus, PlanStatus } from "@/lib/production";

export const EXECUTION_STATUS_VARIANT: Record<ExecutionStatus, BadgeVariant> = {
  PENDING: "warning",
  VALIDATED: "success",
  REJECTED: "destructive",
};

export const FINANCING_STATUS_VARIANT: Record<FinancingStatus, BadgeVariant> = {
  PENDING: "warning",
  IN_ANALYSIS: "info",
  APPROVED: "success",
  REJECTED: "destructive",
  CANCELED: "muted",
  PAID: "success",
};

/** Cor da barra de progresso do plano (cards do agricultor). */
export const PROGRESS_STATUS_VARIANT: Record<ProgressStatus, ProgressVariant> = {
  GOAL_REACHED: "success",
  ON_TRACK: "success",
  BELOW_EXPECTED: "warning",
  DELAYED: "destructive",
  NOT_STARTED: "muted",
};

/** Badge do status de progresso do plano (mesma semântica da barra). */
export const PROGRESS_STATUS_BADGE_VARIANT: Record<ProgressStatus, BadgeVariant> = {
  GOAL_REACHED: "success",
  ON_TRACK: "success",
  BELOW_EXPECTED: "warning",
  DELAYED: "destructive",
  NOT_STARTED: "muted",
};

export const SEVERITY_VARIANT: Record<WarningSeverity, BadgeVariant> = {
  HIGH: "destructive",
  MEDIUM: "warning",
};

export const PLAN_STATUS_VARIANT: Record<PlanStatus, BadgeVariant> = {
  PLANNED: "info",
  ACTIVE: "success",
  FINISHED: "muted",
  CANCELED: "destructive",
};

/**
 * Tipo de ocorrência é categoria, não status: nada de warning/destructive
 * (que significariam "atenção"/"erro"). Usa variantes neutras.
 */
export const OCCURRENCE_TYPE_VARIANT: Record<OccurrenceType, BadgeVariant> = {
  CLIMATE: "secondary",
  PEST: "outline",
  DISEASE: "muted",
};
