"use client";

import type { LucideIcon } from "lucide-react";

import { EmptyState } from "@/components/admin/empty-state";

type DataTableStatusProps = {
  icon: LucideIcon;
  title: string;
  hint: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Ação de navegação (link real). Tem prioridade sobre `onAction`. */
  actionHref?: string;
  /** Peso visual da ação: `default` para criar o primeiro item, `outline` para "Limpar filtros". */
  actionVariant?: "default" | "outline";
  /**
   * `alert` interrompe o leitor de tela (usar só em erro); `status` é o
   * anúncio educado dos estados vazios. Nunca trocar os dois.
   */
  role?: "status" | "alert";
};

/**
 * Estado vazio/erro do `DataTable`. Delega o visual ao `EmptyState` e
 * mantém a API e os textos fixos de sempre.
 */
export function DataTableStatus({
  icon,
  title,
  hint,
  actionLabel,
  onAction,
  actionHref,
  actionVariant = "outline",
  role = "status",
}: DataTableStatusProps) {
  return (
    <EmptyState
      role={role}
      icon={icon}
      title={title}
      hint={hint}
      action={
        actionLabel && actionHref
          ? { label: actionLabel, href: actionHref, variant: actionVariant }
          : actionLabel && onAction
            ? { label: actionLabel, onClick: onAction, variant: actionVariant }
            : undefined
      }
    />
  );
}
