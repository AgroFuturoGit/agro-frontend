import { BackLink } from "@/components/admin/back-link";
import {
  Breadcrumb,
  type BreadcrumbItem,
} from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { FOCUS_TARGET } from "@/lib/focus";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  /** Renderizado em `<h2>`: o `<h1>` ("Painel administrativo") é do shell. */
  title: React.ReactNode;
  /**
   * `id` do título: alvo de foco (`moveFocusTo`) quando um CTA da página
   * desmonta. Com `titleId`, o `<h2>` fica montado também no `loading` (com
   * o skeleton dentro e o nome "Carregando…"), então o foco não se perde na
   * troca carregando → pronto, e ganha anel de foco no teclado (A11Y-L6-6).
   */
  titleId?: string;
  description?: React.ReactNode;
  /** CTA(s) à direita, alinhados à base do bloco de texto; empilham abaixo de `md`. */
  actions?: React.ReactNode;
  breadcrumb?: BreadcrumbItem[];
  back?: { href: string; label: string };
  /** Mostra skeletons no lugar do título e da descrição. */
  loading?: boolean;
  className?: string;
};

/**
 * Cabeçalho de página do painel: breadcrumb opcional, link de retorno,
 * título 30/36 bold, descrição 18/28 medium (o Figma tem 16; 18 evita o
 * salto de 3 degraus 30 → 16) e ações à direita.
 */
export function PageHeader({
  title,
  titleId,
  description,
  actions,
  breadcrumb,
  back,
  loading = false,
  className,
}: PageHeaderProps) {
  const hasBreadcrumb = Boolean(breadcrumb && breadcrumb.length > 0);

  return (
    <div
      data-slot="page-header"
      className={cn("flex flex-col gap-4", className)}
    >
      {hasBreadcrumb && breadcrumb ? <Breadcrumb items={breadcrumb} /> : null}
      <div className="flex flex-col gap-2">
        {back ? <BackLink href={back.href}>{back.label}</BackLink> : null}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            {loading && !titleId ? (
              <div aria-busy="true" className="flex flex-col gap-1">
                <Skeleton className="h-9 w-64 max-w-full" />
                {description !== undefined ? (
                  <Skeleton className="h-7 w-96 max-w-full" />
                ) : null}
                <span className="sr-only">Carregando…</span>
              </div>
            ) : (
              <>
                <h2
                  id={titleId}
                  className={cn(
                    "text-page-title font-bold text-foreground",
                    titleId && cn("rounded-sm", FOCUS_TARGET),
                  )}
                >
                  {loading ? (
                    <>
                      {/* <span> (não o <div> do Skeleton): conteúdo de heading. */}
                      <Skeleton as="span" aria-hidden="true" className="block h-9 w-64 max-w-full" />
                      <span className="sr-only">Carregando…</span>
                    </>
                  ) : (
                    title
                  )}
                </h2>
                {loading ? (
                  description !== undefined ? (
                    <Skeleton className="h-7 w-96 max-w-full" />
                  ) : null
                ) : description ? (
                  <p className="text-lg font-medium text-muted-foreground">
                    {description}
                  </p>
                ) : null}
              </>
            )}
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {actions}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
