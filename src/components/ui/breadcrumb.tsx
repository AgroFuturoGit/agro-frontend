import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

type BreadcrumbProps = {
  items: BreadcrumbItem[];
  className?: string;
};

/**
 * Breadcrumb genérico, sem dependência de dado de domínio. O último item da
 * lista nunca é clicável (mesmo que traga `href`) — representa a página
 * atual. O separador (">" no Figma) é um chevron decorativo, fora do nome
 * acessível; rótulos longos são truncados e mantêm o texto inteiro no
 * `title`.
 */
export function Breadcrumb({ items, className }: BreadcrumbProps) {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        "flex min-w-0 items-center text-sm font-medium text-muted-foreground",
        className,
      )}
    >
      <ol className="flex min-w-0 flex-wrap items-center gap-2">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li
              key={`${item.label}-${index}`}
              className="flex min-w-0 items-center gap-2"
            >
              {index > 0 && (
                <ChevronRight
                  aria-hidden="true"
                  className="size-3.5 shrink-0 text-muted-foreground"
                />
              )}
              {!isLast && item.href ? (
                <Link
                  href={item.href}
                  title={item.label}
                  className="max-w-64 truncate rounded-sm transition-colors outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 motion-reduce:transition-none"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? "page" : undefined}
                  title={item.label}
                  className={cn(
                    "max-w-64 truncate",
                    isLast && "text-foreground-strong",
                  )}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
