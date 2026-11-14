"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DataTableRowAction = {
  /** Nome acessível do botão (ex.: "Editar usuário Ana Souza"). Obrigatório: o botão só tem ícone. */
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
  /** Quando informado, a ação é um link (navegação) em vez de botão. */
  href?: string;
  /** `destructive` só para excluir/remover (ícone vermelho). */
  tone?: "default" | "destructive";
  disabled?: boolean;
};

type DataTableRowActionsProps = {
  actions: DataTableRowAction[];
  /**
   * Alinhamento do grupo; deve acompanhar o `meta.align` da coluna "Ações".
   * Padrão `start`: no Figma (97:91, 124:232) a coluna "Ações" é alinhada à
   * esquerda, sem `meta.align`. Use `end` só com `meta: { align: "right" }`. A margem negativa
   * compensa o respiro interno do botão de 32px, para o ícone alinhar com o
   * texto do cabeçalho.
   */
  align?: "start" | "end";
  className?: string;
};

const TONE_CLASS: Record<NonNullable<DataTableRowAction["tone"]>, string> = {
  default: "text-muted-foreground hover:text-foreground",
  destructive:
    "text-destructive hover:bg-destructive-muted hover:text-destructive-strong",
};

/**
 * Ações de linha do `DataTable` (Figma §4.13): botões ghost só com ícone,
 * 32px, `gap-1`, ícone 16px decorativo. O nome vem de `label` (`aria-label`).
 */
export function DataTableRowActions({
  actions,
  align = "start",
  className,
}: DataTableRowActionsProps) {
  if (actions.length === 0) return null;

  return (
    <div
      data-slot="data-table-row-actions"
      className={cn(
        "flex items-center gap-1",
        align === "end" ? "-mr-2 justify-end" : "-ml-2 justify-start",
        className,
      )}
    >
      {actions.map(({ label, icon: Icon, onClick, href, tone = "default", disabled }) => {
        const toneClass = TONE_CLASS[tone];
        const icon = <Icon aria-hidden="true" className="size-4" />;

        if (href && !disabled) {
          return (
            <Link
              key={label}
              href={href}
              aria-label={label}
              className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), toneClass)}
            >
              {icon}
            </Link>
          );
        }

        return (
          <Button
            key={label}
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
            className={toneClass}
          >
            {icon}
          </Button>
        );
      })}
    </div>
  );
}
