import { CircleCheck } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/production";
import { cn } from "@/lib/utils";

type GoalGaugeProps = {
  /** Porcentagem da meta alcançada. `null` = plano sem meta. */
  percentage: number | null;
  /** Ex.: "Faltam 6,5 t para bater a meta" (montado pelo chamador). */
  remainingLabel?: string;
  /** Meta atingida (≥ 100%): troca a frase por texto + ícone. */
  reached?: boolean;
  loading?: boolean;
  className?: string;
};

// Semicírculo real de raio 66 e traço 16 (Figma 156:29): 148 × 80.
const ARC_PATH = "M 8 72 A 66 66 0 0 1 140 72";

function Arc({ value }: { value: number | null }) {
  return (
    <svg
      viewBox="0 0 148 80"
      className="h-20 w-37"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={ARC_PATH}
        fill="none"
        strokeWidth={16}
        strokeLinecap="round"
        className="stroke-gauge-track"
      />
      {value !== null && value > 0 ? (
        <path
          data-slot="goal-gauge-value"
          d={ARC_PATH}
          fill="none"
          strokeWidth={16}
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${value} 100`}
          className="stroke-primary transition-[stroke-dasharray] duration-500 motion-reduce:transition-none"
        />
      ) : null}
    </svg>
  );
}

/**
 * Escala: % 24 → "meta alcançada" 16 → frase final 12 (no máximo 2 degraus
 * entre vizinhos).
 *
 * Gauge em semicírculo da meta de colheita. O nome acessível
 * ("X% da meta alcançada") fica no `role="img"`; o número e a legenda
 * visíveis repetem a informação e por isso saem da árvore acessível.
 */
export function GoalGauge({
  percentage,
  remainingLabel,
  reached = false,
  loading = false,
  className,
}: GoalGaugeProps) {
  const cardClass = cn(
    "h-full items-center justify-center gap-0 p-6 text-center",
    className,
  );

  if (loading) {
    return (
      <Card aria-busy="true" className={cardClass}>
        <Skeleton className="h-20 w-37 rounded-t-full rounded-b-none" />
        <Skeleton className="mt-2 h-8 w-24" />
        <Skeleton className="mt-2 h-6 w-28" />
        <span className="sr-only">Carregando meta alcançada</span>
      </Card>
    );
  }

  if (percentage === null) {
    return (
      <Card className={cardClass}>
        <Arc value={null} />
        <p className="mt-2 text-sm font-medium text-muted-foreground">
          Sem meta definida
        </p>
      </Card>
    );
  }

  const clamped = Math.max(0, Math.min(100, percentage));
  const formatted = `${formatNumber(percentage)}%`;

  return (
    <Card className={cardClass}>
      <div
        role="img"
        aria-label={`${formatted} da meta alcançada`}
        className="flex flex-col items-center"
      >
        <Arc value={clamped} />
        <span
          aria-hidden="true"
          className="-mt-8 text-gauge font-bold text-primary tabular-nums"
        >
          {formatted}
        </span>
        <span
          aria-hidden="true"
          className="mt-2 text-base font-medium text-muted-foreground"
        >
          meta alcançada
        </span>
      </div>
      {reached ? (
        <p className="mt-2 inline-flex items-center gap-1 text-caption font-medium text-success">
          <CircleCheck aria-hidden="true" className="size-4 shrink-0" />
          Meta de colheita atingida
        </p>
      ) : remainingLabel ? (
        <p className="mt-2 text-caption font-medium text-subtle-foreground">
          {remainingLabel}
        </p>
      ) : null}
    </Card>
  );
}
