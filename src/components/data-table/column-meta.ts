import type { RowData } from "@tanstack/react-table";

import { cn } from "@/lib/utils";

/**
 * Metadados visuais das colunas do `DataTable` (`columnDef.meta`). Todos são
 * opcionais: colunas sem `meta` continuam como antes (alinhadas à esquerda,
 * cor herdada).
 *
 * - `align`: alinhamento do cabeçalho e das células (padrão `left`; `numeric`
 *   muda o padrão para `right`).
 * - `cellVariant`: `primary` = identificação da linha (`font-medium
 *   text-foreground`); `secondary` = dado de apoio (`text-muted-foreground`).
 * - `numeric`: valores numéricos com `tabular-nums`, alinhados à direita.
 * - `headerClassName` / `cellClassName`: escape para casos pontuais.
 *
 * Coluna de ações: sem `align` (à esquerda, como no Figma) + `DataTableRowActions`.
 */
export type DataTableColumnAlign = "left" | "center" | "right";
export type DataTableCellVariant = "default" | "primary" | "secondary";

declare module "@tanstack/react-table" {
  // Os parâmetros genéricos precisam ser idênticos aos da declaração original.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    align?: DataTableColumnAlign;
    cellVariant?: DataTableCellVariant;
    numeric?: boolean;
    headerClassName?: string;
    cellClassName?: string;
  }
}

type VisualMeta = {
  align?: DataTableColumnAlign;
  cellVariant?: DataTableCellVariant;
  numeric?: boolean;
  headerClassName?: string;
  cellClassName?: string;
};

const ALIGN_CLASS: Record<DataTableColumnAlign, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

const CELL_VARIANT_CLASS: Record<DataTableCellVariant, string> = {
  default: "",
  primary: "font-medium text-foreground",
  secondary: "text-muted-foreground",
};

function resolveAlign(meta: VisualMeta | undefined): DataTableColumnAlign {
  return meta?.align ?? (meta?.numeric ? "right" : "left");
}

/** Classes do `<th>` a partir do `meta` da coluna. */
export function headerMetaClass(meta: VisualMeta | undefined) {
  if (!meta) return "";
  return cn(ALIGN_CLASS[resolveAlign(meta)], meta.headerClassName);
}

/** Classes do `<td>` a partir do `meta` da coluna. */
export function cellMetaClass(meta: VisualMeta | undefined) {
  if (!meta) return "";
  return cn(
    ALIGN_CLASS[resolveAlign(meta)],
    CELL_VARIANT_CLASS[meta.cellVariant ?? "default"],
    meta.numeric && "tabular-nums",
    meta.cellClassName,
  );
}
