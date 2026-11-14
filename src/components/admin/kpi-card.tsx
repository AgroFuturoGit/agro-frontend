import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type KpiCardProps = {
  label: string;
  /** Valor já formatado. `null`/`undefined`/`""` viram "—" (anunciado como "sem dados"). */
  value: React.ReactNode;
  hint?: React.ReactNode;
  /** Ícone decorativo à direita do label. */
  icon?: LucideIcon;
  highlight?: boolean;
  /** Skeleton do label, do ícone e do número no tamanho final. */
  loading?: boolean;
  className?: string;
};

function isEmptyValue(value: React.ReactNode) {
  return value === null || value === undefined || value === "";
}

/**
 * Indicador de dashboard. Estrutura acessível: `<dl>` com `<dt>` (label +
 * ícone) e `<dd>` (valor e dica) como irmãos diretos — o label e o valor
 * ficam no mesmo elemento pai.
 */
export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  highlight = false,
  loading = false,
  className,
}: KpiCardProps) {
  if (loading) {
    return (
      <Card
        aria-busy="true"
        className={cn("gap-0 p-6", className)}
        variant={highlight ? "highlight" : "default"}
      >
        <div className="flex items-start justify-between gap-2">
          <Skeleton className="h-4 w-28" />
          {Icon ? <Skeleton className="size-4" /> : null}
        </div>
        <Skeleton className="mt-2 h-9 w-20" />
        <span className="sr-only">Carregando {label}</span>
      </Card>
    );
  }

  return (
    <Card
      className={cn("gap-0 p-6", className)}
      variant={highlight ? "highlight" : "default"}
    >
      <dl className="flex flex-col">
        <dt className="flex items-start justify-between gap-2 text-sm leading-4 text-muted-foreground">
          {label}
          {Icon ? (
            <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          ) : null}
        </dt>
        <dd className="mt-2 text-kpi font-bold text-foreground tabular-nums">
          {isEmptyValue(value) ? (
            <>
              <span aria-hidden="true">—</span>
              <span className="sr-only">sem dados</span>
            </>
          ) : (
            value
          )}
        </dd>
        {hint ? (
          <dd className="mt-1 text-sm text-muted-foreground">{hint}</dd>
        ) : null}
      </dl>
    </Card>
  );
}

/** Grade dos KPIs: 2 colunas, 4 a partir de `lg`. */
export function KpiGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-4 lg:grid-cols-4", className)}>
      {children}
    </div>
  );
}
