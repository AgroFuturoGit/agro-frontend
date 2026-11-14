"use client";

import { GoalGauge } from "@/components/admin/goal-gauge";
import { StatCard } from "@/components/admin/stat-card";
import {
  formatNumber,
  type ProductionComparison,
} from "@/lib/production";

type Props = {
  comparison: ProductionComparison;
  unit?: string;
};

/**
 * Linha de resumo do plano (e do consolidado de Relatórios): gauge em
 * semicírculo + Previsto / Realizado / Diferença, os quatro na mesma altura.
 */
export function ComparisonSummary({ comparison, unit = "kg" }: Props) {
  const { expectedYield, totalActualYield, difference, percentageRealized } =
    comparison;
  const remaining = difference < 0 ? Math.abs(difference) : 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <GoalGauge
        percentage={percentageRealized}
        reached={remaining === 0}
        remainingLabel={
          remaining > 0
            ? `Faltam ${formatNumber(remaining)} ${unit} para bater a meta`
            : undefined
        }
      />
      <StatCard label="Previsto" value={`${formatNumber(expectedYield)} ${unit}`} />
      <StatCard
        label="Realizado"
        value={`${formatNumber(totalActualYield)} ${unit}`}
      />
      <StatCard
        label="Diferença"
        value={`${difference > 0 ? "+" : ""}${formatNumber(difference)} ${unit}`}
      />
    </div>
  );
}
