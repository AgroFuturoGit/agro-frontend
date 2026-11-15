import * as React from "react"
import {
  CircleAlert,
  CircleCheck,
  Info,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type InlineAlertVariant = "destructive" | "warning" | "success" | "info"

const variantClasses: Record<InlineAlertVariant, string> = {
  destructive: "border-destructive/30 bg-destructive-muted text-destructive-strong",
  warning: "border-warning/30 bg-warning-muted text-warning-strong",
  success: "border-success/30 bg-success-muted text-success",
  info: "border-info/30 bg-info-muted text-info",
}

const defaultIcons: Record<InlineAlertVariant, LucideIcon> = {
  destructive: CircleAlert,
  warning: TriangleAlert,
  success: CircleCheck,
  info: Info,
}

// Erros e avisos interrompem o leitor de tela; sucesso e informação não.
const defaultRoles: Record<InlineAlertVariant, "alert" | "status"> = {
  destructive: "alert",
  warning: "alert",
  success: "status",
  info: "status",
}

type InlineAlertAction = {
  label: string
  onClick: () => void
  disabled?: boolean
}

type InlineAlertProps = Omit<React.ComponentProps<"div">, "role" | "children"> & {
  variant?: InlineAlertVariant
  /** Padrão: "alert" para destructive/warning e "status" para success/info. */
  role?: "alert" | "status"
  /** Ícone à esquerda (sempre aria-hidden). `false` remove o ícone. */
  icon?: LucideIcon | false
  /** Botão outline compacto à direita (ex.: "Tentar novamente"). */
  action?: InlineAlertAction
  /**
   * Vários botões à direita, na mesma forma do `action` (ex.: "Limpar
   * filtros" + "Tentar novamente"). Renderizados depois do `action`.
   */
  actions?: InlineAlertAction[]
  children: React.ReactNode
}

function InlineAlert({
  variant = "destructive",
  role,
  icon,
  action,
  actions,
  className,
  children,
  ...props
}: InlineAlertProps) {
  const allActions = [...(action ? [action] : []), ...(actions ?? [])]
  const Icon = icon === false ? null : (icon ?? defaultIcons[variant])
  return (
    <div
      data-slot="inline-alert"
      data-variant={variant}
      role={role ?? defaultRoles[variant]}
      className={cn(
        "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm",
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {Icon ? (
        <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      ) : null}
      <div className="min-w-0 flex-1">{children}</div>
      {allActions.length > 0 ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 self-center">
          {allActions.map((a, i) => (
            <Button
              key={`${i}-${a.label}`}
              type="button"
              variant="outline"
              size="sm"
              className="text-foreground"
              onClick={a.onClick}
              disabled={a.disabled}
            >
              {a.label}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export type { InlineAlertAction, InlineAlertProps, InlineAlertVariant }
export { InlineAlert }
