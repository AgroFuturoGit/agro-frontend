"use client";

import { GoalGauge } from "@/components/admin/goal-gauge";
import { StatCard } from "@/components/admin/stat-card";
import {
  formatNumber,
  type ProductionComparison,
} from "@/lib/production";

type Props = {
  /** `null` só durante o carregamento (`loading`). */
  comparison: ProductionComparison | null;
  unit?: string;
  /** Skeleton dos 4 cards, com as mesmas dimensões do conteúdo final. */
  loading?: boolean;
};

const GRID_CLASS = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4";

/**
 * Linha de resumo do plano (e do consolidado de Relatórios): gauge em
 * semicírculo + Previsto / Realizado / Diferença, os quatro na mesma altura.
 */
export function ComparisonSummary({
  comparison,
  unit = "kg",
  loading = false,
}: Props) {
  if (loading) {
    return (
      <div className={GRID_CLASS}>
        <GoalGauge percentage={null} loading />
        <StatCard label="Previsto" value={null} loading />
        <StatCard label="Realizado" value={null} loading />
        <StatCard label="Diferença" value={null} loading />
      </div>
    );
  }
  if (!comparison) return null;

  const { expectedYield, totalActualYield, difference, percentageRealized } =
    comparison;
  const remaining = difference < 0 ? Math.abs(difference) : 0;
  // Sem previsto não há meta: o gauge mostra "Sem meta definida" em vez de
  // "0% / meta atingida".
  const hasGoal = expectedYield > 0;

  return (
    <div className={GRID_CLASS}>
      <GoalGauge
        percentage={hasGoal ? percentageRealized : null}
        reached={hasGoal && remaining === 0}
        remainingLabel={
          hasGoal && remaining > 0
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
        tone={difference < 0 ? "negative" : difference > 0 ? "positive" : "default"}
        value={`${difference > 0 ? "+" : ""}${formatNumber(difference)} ${unit}`}
      />
    </div>
  );
}
