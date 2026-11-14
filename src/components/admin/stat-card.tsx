import { EmptyValue, isEmptyValue } from "@/components/admin/empty-value";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type StatCardProps = {
  /** Sem caixa alta: "Previsto", "Realizado", "Diferença". */
  label: string;
  /** Valor já formatado. `null`/`undefined`/`""` viram "—" (anunciado como "sem dados"). */
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

/**
 * Card de número: label 16 + valor 24 `tabular-nums` (no máximo 2 degraus
 * entre vizinhos). Acompanha a altura da linha. Vazio = "—" neutro.
 */
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
        <Skeleton className="h-6 w-20" />
        <Skeleton className="mt-2 h-8 w-28" />
        <span className="sr-only">Carregando {label}</span>
      </Card>
    );
  }

  const empty = isEmptyValue(value);
  // Sem valor não há o que reforçar: o "—" fica sempre neutro.
  const effectiveTone = empty ? "default" : tone;

  return (
    <Card data-tone={effectiveTone} className={cn("h-full gap-0 p-6", className)}>
      <dl className="flex flex-col">
        <dt className="text-base text-muted-foreground">{label}</dt>
        <dd
          className={cn(
            "mt-2 text-kpi font-bold tabular-nums",
            toneClasses[effectiveTone],
          )}
        >
          {empty ? <EmptyValue /> : value}
        </dd>
      </dl>
    </Card>
  );
}
