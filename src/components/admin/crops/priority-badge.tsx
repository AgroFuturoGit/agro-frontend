import { Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { CATEGORY_BADGE_VARIANT } from "@/lib/status-variants";
import { cn } from "@/lib/utils";

type Props = {
  isPriority: boolean;
  className?: string;
};

/**
 * "Prioritária" é categoria, não status: badge `outline` (ver
 * `CATEGORY_BADGE_VARIANT`) com a estrela do Figma (109:498) como ícone
 * decorativo. Sem prioridade, "—" visual com texto para leitor de tela.
 */
export function PriorityBadge({ isPriority, className }: Props) {
  if (!isPriority) {
    return (
      <span className={cn("text-muted-foreground", className)}>
        <span aria-hidden="true">—</span>
        <span className="sr-only">Não prioritária</span>
      </span>
    );
  }

  return (
    <Badge
      variant={CATEGORY_BADGE_VARIANT}
      icon={Star}
      className={cn("[&>svg]:fill-current", className)}
    >
      Prioritária
    </Badge>
  );
}
