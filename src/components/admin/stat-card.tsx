import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type StatCardProps = {
  /** Sem caixa alta: "Previsto", "Realizado", "Diferença". */
  label: string;
  value: React.ReactNode;
  /** Só reforço visual: o sinal (+/−) continua no texto do valor. */
  tone?: "default" | "positive" | "negative";
  loading?: boolean;
  className?: string;
};

const toneClasses: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "text-foreground",
  positive: "text-success",
  negative: "text-destructive",
};

/** Card de número: label 12px + valor grande `tabular-nums`. Acompanha a altura da linha. */
export function StatCard({
  label,
  value,
  tone = "default",
  loading = false,
  className,
}: StatCardProps) {
  if (loading) {
    return (
      <Card aria-busy="true" className={cn("h-full gap-0 p-6", className)}>
        <Skeleton className="h-4 w-20" />
        <Skeleton className="mt-2 h-9 w-28" />
        <span className="sr-only">Carregando {label}</span>
      </Card>
    );
  }

  return (
    <Card data-tone={tone} className={cn("h-full gap-0 p-6", className)}>
      <dl className="flex flex-col">
        <dt className="text-caption text-muted-foreground">{label}</dt>
        <dd className={cn("mt-2 text-kpi font-bold tabular-nums", toneClasses[tone])}>
          {value}
        </dd>
      </dl>
    </Card>
  );
}
