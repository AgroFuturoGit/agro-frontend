import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";

type BackLinkProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
};

/**
 * Link de retorno para o nível anterior ("Voltar para planos"). É um link
 * (navegação), não um botão; a seta é decorativa.
 */
export function BackLink({ href, children, className }: BackLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex w-fit items-center gap-2 rounded-sm text-sm text-subtle-foreground transition-colors outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none",
        className,
      )}
    >
      <ArrowLeft aria-hidden="true" className="size-3.5 shrink-0" />
      {children}
    </Link>
  );
}
