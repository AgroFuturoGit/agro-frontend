import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// Registra os tokens próprios do `@theme` (globals.css) para o merge de
// classes: sem isso, `text-kpi` é lido como cor e some ao lado de
// `text-foreground`, e `size-control`/`size-control-sm` não se substituem.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["page-title", "section-title", "kpi", "gauge", "body", "caption"],
      spacing: ["control", "control-sm", "section", "section-sm"],
      radius: ["nav"],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
