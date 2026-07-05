"use client";

import { cn } from "@/lib/utils";
import {
  formatNumber,
  type ProductionComparison,
} from "@/lib/production";
import { Card, CardContent } from "@/components/ui/card";

/** Gauge semicircular mostrando a porcentagem da meta alcançada. */
function Gauge({ percentage }: { percentage: number }) {
  const clamped = Math.max(0, Math.min(100, percentage));
  const radius = 70;
  const circumference = Math.PI * radius; // semicírculo
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className="relative flex flex-col items-center">
      <svg
        width="180"
        height="100"
        viewBox="0 0 180 100"
        role="img"
        aria-label={`${formatNumber(percentage)}% da meta alcançada`}
      >
        <path
          d="M 20 90 A 70 70 0 0 1 160 90"
          fill="none"
          strokeWidth="14"
          strokeLinecap="round"
          className="stroke-muted"
        />
        <path
          d="M 20 90 A 70 70 0 0 1 160 90"
          fill="none"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-primary transition-all duration-500"
          stroke="currentColor"
        />
      </svg>
      <div className="-mt-8 flex flex-col items-center">
        <span className="text-3xl font-semibold tabular-nums text-primary">
          {formatNumber(percentage)}%
        </span>
        <span className="text-xs text-muted-foreground">meta alcançada</span>
      </div>
    </div>
  );
}

type Props = {
  comparison: ProductionComparison;
  unit?: string;
};

export function ComparisonSummary({ comparison, unit = "t" }: Props) {
  const { expectedYield, totalActualYield, difference, percentageRealized } =
    comparison;
  const remaining = difference < 0 ? Math.abs(difference) : 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[auto_1fr] lg:items-center">
      <Card className="items-center justify-center">
        <CardContent className="flex flex-col items-center gap-1 py-2">
          <Gauge percentage={percentageRealized} />
          <p className="text-center text-sm text-muted-foreground">
            {remaining > 0
              ? `Faltam ${formatNumber(remaining)} ${unit} para bater a meta`
              : "Meta de colheita atingida 🎉"}
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Previsto" value={`${formatNumber(expectedYield)} ${unit}`} />
        <Stat
          label="Realizado"
          value={`${formatNumber(totalActualYield)} ${unit}`}
        />
        <Stat
          label="Diferença"
          value={`${difference > 0 ? "+" : ""}${formatNumber(difference)} ${unit}`}
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 py-1">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span
          className={cn(
            "text-2xl font-semibold tabular-nums text-foreground",
            valueClassName,
          )}
        >
          {value}
        </span>
      </CardContent>
    </Card>
  );
}
