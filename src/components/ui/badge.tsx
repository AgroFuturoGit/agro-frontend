import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { CircleCheck, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

// Base: registry shadcn base-nova (badge). Acrescentadas as variantes
// semânticas success/warning/info/muted e o tamanho do Figma (24px, pílula,
// texto 14px como em 109:498/131:941).
// O texto do badge é sempre o que comunica o status; a cor só reforça.
// Como o verde da marca é o mesmo verde de sucesso, o badge `success` leva
// um ícone `CircleCheck` por padrão (status ≠ categoria). Badges de categoria
// usam `outline` (ver `CATEGORY_BADGE_VARIANT` em `@/lib/status-variants`).
const badgeVariants = cva(
  "group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2.5 py-0.5 text-sm font-medium whitespace-nowrap transition-all motion-reduce:transition-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3.5!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary-hover",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive-muted text-destructive-strong focus-visible:ring-destructive/20 [a]:hover:bg-destructive-muted/80",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
        success: "bg-success-muted text-success [a]:hover:bg-success-muted/80",
        warning:
          "bg-warning-muted text-warning-strong [a]:hover:bg-warning-muted/80",
        info: "bg-info-muted text-info [a]:hover:bg-info-muted/80",
        muted: "bg-muted text-foreground [a]:hover:bg-muted/80",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>

/** Ícone padrão por variante: só `success` tem (diferencia status de categoria). */
const defaultBadgeIcons: Partial<Record<BadgeVariant, LucideIcon>> = {
  success: CircleCheck,
}

type BadgeProps = useRender.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    /**
     * Ícone decorativo antes do texto (sempre `aria-hidden`). Padrão:
     * `CircleCheck` na variante `success`; `false` remove.
     */
    icon?: LucideIcon | false
  }

function Badge({
  className,
  variant = "default",
  icon,
  render,
  children,
  ...props
}: BadgeProps) {
  const Icon =
    icon === false ? null : (icon ?? defaultBadgeIcons[variant ?? "default"] ?? null)
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
        children: Icon ? (
          <>
            <Icon aria-hidden="true" data-icon="inline-start" />
            {children}
          </>
        ) : (
          children
        ),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export type { BadgeProps, BadgeVariant }
export { Badge, badgeVariants }
