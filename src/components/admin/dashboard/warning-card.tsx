import Link from "next/link";
import { ArrowRight, CircleAlert, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  TechnicianWarning,
  WarningSeverity,
  WarningType,
} from "@/lib/analytics";
import { FOCUS_RING_LINK } from "@/lib/focus";
import { formatNumber, formatPlanDate } from "@/lib/production";
import {
  CATEGORY_BADGE_VARIANT,
  SEVERITY_VARIANT,
} from "@/lib/status-variants";
import { cn } from "@/lib/utils";

export const WARNING_TYPE_LABELS: Record<WarningType, string> = {
  INACTIVE_EXECUTIONS: "Sem apontamentos recentes",
  LOW_YIELD_RISK: "Risco de baixa produção",
  HARVEST_OVERDUE: "Colheita atrasada",
};

const SEVERITY_LABELS: Record<WarningSeverity, string> = {
  HIGH: "Alta",
  MEDIUM: "Média",
};

// Ícone diferente por severidade: a cor não é o único sinal.
const SEVERITY_ICON = {
  HIGH: CircleAlert,
  MEDIUM: TriangleAlert,
} satisfies Record<WarningSeverity, unknown>;

/** Cartão de um alerta da carteira; `href` leva ao plano (ausente = sem link). */
export function WarningCard({
  warning,
  href,
}: {
  warning: TechnicianWarning;
  href: string | null;
}) {
  const crop = warning.cropVariety
    ? `${warning.cropName} · ${warning.cropVariety}`
    : warning.cropName;
  const farmer = warning.farmerName ?? "Agricultor";
  return (
    <Card
      data-testid="warning-card"
      data-severity={warning.severity}
      className="gap-4 py-6"
    >
      <CardHeader className="px-6">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-semibold">{farmer}</CardTitle>
          <Badge
            variant={SEVERITY_VARIANT[warning.severity]}
            icon={SEVERITY_ICON[warning.severity]}
          >
            {`Severidade ${SEVERITY_LABELS[warning.severity]}`}
          </Badge>
        </div>
        <CardDescription className="text-sm text-muted-foreground">
          {warning.communityName ? `${warning.communityName} · ` : ""}
          {crop}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 px-6">
        <ul className="flex flex-wrap gap-2" aria-label="Tipos de alerta">
          {warning.warningTypes.map((type) => (
            <li key={type}>
              <Badge variant={CATEGORY_BADGE_VARIANT}>
                {WARNING_TYPE_LABELS[type]}
              </Badge>
            </li>
          ))}
        </ul>
        {warning.message && <p className="text-sm">{warning.message}</p>}
        <p className="text-sm text-muted-foreground">
          {warning.daysWithoutExecution !== null
            ? `${formatNumber(warning.daysWithoutExecution)} dias sem apontamento`
            : `Último apontamento: ${formatPlanDate(warning.lastExecutionDate)}`}
          {" · "}
          Conclusão {formatNumber(warning.completionPct)}%
        </p>
        {href && (
          <Link
            href={href}
            className={cn(
              "mt-auto inline-flex w-fit items-center gap-1 rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline",
              FOCUS_RING_LINK,
            )}
          >
            Ver plano
            <span className="sr-only">
              {" "}
              de {farmer} ({crop})
            </span>
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
