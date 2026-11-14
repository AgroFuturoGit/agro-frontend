import { cn } from "@/lib/utils";

type SectionHeaderProps = {
  /** `id` do `<h3>`, para âncoras e `aria-labelledby` da seção. */
  id?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};

/** Cabeçalho de seção dentro de uma página: `<h3>` 20/28 bold + descrição + ação à direita. */
export function SectionHeader({
  id,
  title,
  description,
  actions,
  className,
}: SectionHeaderProps) {
  return (
    <div
      data-slot="section-header"
      className={cn(
        "flex flex-col gap-4 md:flex-row md:items-start md:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <h3 id={id} className="text-section-title font-bold text-foreground">
          {title}
        </h3>
        {description ? (
          <p className="text-base text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
