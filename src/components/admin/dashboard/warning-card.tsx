import Link from "next/link";
import { AlertTriangle } from "lucide-react";

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
import { formatNumber, formatPlanDate } from "@/lib/production";

export const WARNING_TYPE_LABELS: Record<WarningType, string> = {
  INACTIVE_EXECUTIONS: "Sem apontamentos recentes",
  LOW_YIELD_RISK: "Risco de baixa produção",
  HARVEST_OVERDUE: "Colheita atrasada",
};

const SEVERITY_LABELS: Record<WarningSeverity, string> = {
  HIGH: "Alta",
  MEDIUM: "Média",
};

const SEVERITY_BADGE: Record<WarningSeverity, string> = {
  HIGH: "bg-red-100 text-red-800",
  MEDIUM: "bg-yellow-100 text-yellow-900",
};

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
    <Card data-testid="warning-card" data-severity={warning.severity}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{farmer}</CardTitle>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_BADGE[warning.severity]}`}
          >
            <AlertTriangle className="size-3" aria-hidden />
            Severidade {SEVERITY_LABELS[warning.severity]}
          </span>
        </div>
        <CardDescription>
          {warning.communityName ? `${warning.communityName} · ` : ""}
          {crop}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <ul className="flex flex-wrap gap-1">
          {warning.warningTypes.map((type) => (
            <li
              key={type}
              className="rounded-md border px-2 py-0.5 text-xs font-medium"
            >
              {WARNING_TYPE_LABELS[type]}
            </li>
          ))}
        </ul>
        {warning.message && <p className="text-sm">{warning.message}</p>}
        <p className="text-xs text-muted-foreground">
          {warning.daysWithoutExecution !== null
            ? `${formatNumber(warning.daysWithoutExecution)} dias sem apontamento`
            : `Último apontamento: ${formatPlanDate(warning.lastExecutionDate)}`}
          {" · "}
          Conclusão {formatNumber(warning.completionPct)}%
        </p>
        {href && (
          <Link
            href={href}
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Ver plano
            <span className="sr-only">
              {" "}
              de {farmer} ({crop})
            </span>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
