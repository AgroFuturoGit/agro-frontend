import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type EmptyStateAction = {
  label: string;
  onClick?: () => void;
  /** Quando informado, a ação vira link (navegação) em vez de botão. */
  href?: string;
  variant?: "default" | "outline";
};

type EmptyStateProps = {
  icon?: LucideIcon;
  title: React.ReactNode;
  hint?: React.ReactNode;
  action?: EmptyStateAction;
  /**
   * `status` (padrão) é o anúncio educado de vazio; `alert` só para erro ou
   * "não encontrado". O `role` fica no mesmo nó que contém os textos.
   */
  role?: "status" | "alert";
  /** Tag do título. `h1` só fora do shell (ex.: página 404). */
  headingLevel?: "h1" | "h2" | "p";
  /** `plain` (padrão) não desenha superfície: para uso dentro de um card. */
  variant?: "plain" | "card" | "dashed";
  className?: string;
};

const variantClasses: Record<NonNullable<EmptyStateProps["variant"]>, string> = {
  plain: "",
  card: "rounded-xl border border-border bg-card",
  dashed: "rounded-xl border border-dashed border-border",
};

/** Estado vazio/erro com ícone, título, dica e uma ação opcional. */
export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
  role = "status",
  headingLevel = "p",
  variant = "plain",
  className,
}: EmptyStateProps) {
  const Title = headingLevel;
  const actionVariant = action?.variant ?? "outline";

  return (
    <div
      role={role}
      data-slot="empty-state"
      data-variant={variant}
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-6 py-12 text-center whitespace-normal",
        variantClasses[variant],
        className,
      )}
    >
      {Icon ? (
        <Icon aria-hidden="true" className="mb-2 size-8 text-muted-foreground" />
      ) : null}
      <Title className="text-base font-medium text-foreground">{title}</Title>
      {hint ? (
        <p className="max-w-sm text-sm text-muted-foreground">{hint}</p>
      ) : null}
      {action?.href ? (
        // Link de verdade (role=link), com o visual do botão.
        <Link
          href={action.href}
          className={cn(buttonVariants({ variant: actionVariant }), "mt-2")}
        >
          {action.label}
        </Link>
      ) : action?.onClick ? (
        <Button
          type="button"
          variant={actionVariant}
          className="mt-2"
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
