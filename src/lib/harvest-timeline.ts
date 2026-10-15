import type { ProductionExecution, ProductionPlan } from "@/lib/production";

export type TimelineGranularity = "WEEK" | "MONTH";

export type TimelinePoint = {
  /** Início do período, "YYYY-MM-DD". */
  date: string;
  /** kg previstos no período; null quando o plano não tem janela. */
  expectedValue: number | null;
  /** kg VALIDATED no período. */
  actualValue: number;
  /** kg PENDING no período. */
  pendingValue: number;
};

export type HarvestTimeline = {
  harvestType: "SINGLE" | "CONTINUOUS";
  granularity: TimelineGranularity;
  unit: "kg";
  hasExpectedWindow: boolean;
  points: TimelinePoint[];
};

/** Máximo de semanas para a granularidade automática ficar em WEEK (BR-004). */
export const AUTO_WEEK_LIMIT = 16;
/** Margem, em dias (~5 anos), além da qual uma data é tratada como erro de digitação. */
export const OUTLIER_MARGIN_DAYS = 1826;

/** Sem janela, a referência para descartar datas absurdas é a mediana das datas. */
function withinMarginOfMedian(days: number[]): (day: number) => boolean {
  if (days.length === 0) return () => true;
  const sorted = [...days].sort((a, b) => a - b);
  const median = sorted[Math.floor((sorted.length - 1) / 2)];
  return (day) => Math.abs(day - median) <= OUTLIER_MARGIN_DAYS;
}

const DAY_MS = 86_400_000;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/;

// Datas civis (BR-001): "YYYY-MM-DD" vira um número de dias desde 1970-01-01
// via Date.UTC, sem passar por fuso local.
function parseDay(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = DATE_RE.exec(value);
  if (!match) return null;
  return Math.floor(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / DAY_MS,
  );
}

function formatDay(day: number): string {
  const d = new Date(day * DAY_MS);
  const y = String(d.getUTCFullYear()).padStart(4, "0");
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// 1970-01-01 foi quinta-feira: (dia + 3) % 7 → 0 = segunda.
function weekStart(day: number): number {
  const offset = (((day + 3) % 7) + 7) % 7;
  return day - offset;
}

function monthStart(day: number): number {
  const d = new Date(day * DAY_MS);
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / DAY_MS);
}

function nextMonthStart(start: number): number {
  const d = new Date(start * DAY_MS);
  return Math.floor(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) / DAY_MS,
  );
}

function periodStart(day: number, granularity: TimelineGranularity): number {
  return granularity === "WEEK" ? weekStart(day) : monthStart(day);
}

function periodEnd(start: number, granularity: TimelineGranularity): number {
  return granularity === "WEEK" ? start + 7 : nextMonthStart(start);
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export function buildHarvestTimeline(
  plan: ProductionPlan,
  executions: ProductionExecution[],
  granularity?: TimelineGranularity,
): HarvestTimeline {
  const harvestType = plan.crop?.harvestType === "CONTINUOUS" ? "CONTINUOUS" : "SINGLE";

  // BR-005: só VALIDATED e PENDING com data válida entram.
  const counted = executions.flatMap((execution) => {
    const day = parseDay(execution.harvestedAt);
    if (day === null) return [];
    if (execution.status !== "VALIDATED" && execution.status !== "PENDING") {
      return [];
    }
    return [{ day, status: execution.status, kg: execution.quantityKg }];
  });

  const winStart = parseDay(plan.expectedHarvestStart);
  const winEnd = parseDay(plan.expectedHarvestEnd);
  const validWindow = winStart !== null && winEnd !== null && winEnd >= winStart;
  const hasExpectedWindow = validWindow && plan.expectedYield > 0;

  // Data com ano digitado errado (ex.: 2206) geraria milhares de períodos:
  // fica de fora do gráfico (continua na tabela) o que estiver a mais de
  // OUTLIER_MARGIN_DAYS da janela ou, sem janela, da mediana das datas.
  const inRange = validWindow
    ? (day: number) =>
        day >= winStart - OUTLIER_MARGIN_DAYS && day <= winEnd + OUTLIER_MARGIN_DAYS
    : withinMarginOfMedian(counted.map((c) => c.day));
  const plotted = counted.filter((c) => inRange(c.day));

  // BR-003: intervalo do eixo.
  const days = plotted.map((c) => c.day);
  if (validWindow) {
    days.push(winStart, winEnd);
  }

  let resolved: TimelineGranularity = granularity ?? "WEEK";
  if (days.length === 0) {
    return {
      harvestType,
      granularity: resolved,
      unit: "kg",
      hasExpectedWindow,
      points: [],
    };
  }

  const minDay = Math.min(...days);
  const maxDay = Math.max(...days);

  if (granularity === undefined) {
    const weeks = (weekStart(maxDay) - weekStart(minDay)) / 7 + 1;
    resolved = weeks <= AUTO_WEEK_LIMIT ? "WEEK" : "MONTH";
  }

  const starts: number[] = [];
  for (
    let s = periodStart(minDay, resolved);
    s <= maxDay;
    s = periodEnd(s, resolved)
  ) {
    starts.push(s);
  }

  const points: TimelinePoint[] = starts.map((s) => ({
    date: formatDay(s),
    expectedValue: hasExpectedWindow ? 0 : null,
    actualValue: 0,
    pendingValue: 0,
  }));

  // Cada apontamento conta uma única vez, no período do seu harvestedAt.
  const indexOf = (day: number) =>
    starts.findIndex((s) => day >= s && day < periodEnd(s, resolved));
  for (const c of plotted) {
    const point = points[indexOf(c.day)];
    if (c.status === "VALIDATED") point.actualValue += c.kg;
    else point.pendingValue += c.kg;
  }
  for (const p of points) {
    p.actualValue = round2(p.actualValue);
    p.pendingValue = round2(p.pendingValue);
  }

  // BR-006: previsto proporcional aos dias da janela em cada período.
  if (hasExpectedWindow) {
    const totalDays = winEnd - winStart + 1;
    let lastInWindow = -1;
    let allocated = 0;
    starts.forEach((s, i) => {
      const overlap =
        Math.min(periodEnd(s, resolved) - 1, winEnd) - Math.max(s, winStart) + 1;
      if (overlap > 0) {
        const value = round2((plan.expectedYield * overlap) / totalDays);
        points[i].expectedValue = value;
        allocated += value;
        lastInWindow = i;
      }
    });
    if (lastInWindow >= 0) {
      const last = points[lastInWindow];
      last.expectedValue = round2(
        (last.expectedValue ?? 0) + (plan.expectedYield - allocated),
      );
    }
  }

  return {
    harvestType,
    granularity: resolved,
    unit: "kg",
    hasExpectedWindow,
    points,
  };
}
