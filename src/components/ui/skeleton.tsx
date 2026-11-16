import { cn } from "@/lib/utils"

type SkeletonProps = React.HTMLAttributes<HTMLElement> & {
  /** `span` para caber em conteúdo de frase (ex.: dentro de um h2 ou <p>). */
  as?: "div" | "span"
}

function Skeleton({ as: Comp = "div", className, ...props }: SkeletonProps) {
  return (
    <Comp
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
