"use client";

import type { Column } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

type DataTableColumnHeaderProps<TData, TValue> = {
  column: Column<TData, TValue>;
  title: string;
  disabled?: boolean;
};

/**
 * Botão de ordenação do cabeçalho. O `aria-sort` é responsabilidade do
 * `<th>` (ver `data-table.tsx`) — aqui os ícones são puramente decorativos.
 * Sem ordenação: ⇅ neutro; ordenado: seta da direção.
 */
export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  disabled,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <span>{title}</span>;
  }

  const sorted = column.getIsSorted();

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => column.toggleSorting(sorted === "asc")}
      className="-mx-1 inline-flex min-h-8 items-center gap-1 rounded-md px-1 font-medium text-foreground transition-colors hover:text-foreground-strong focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50 motion-reduce:transition-none"
    >
      {title}
      {sorted === "asc" ? (
        <ArrowUp className="size-3" aria-hidden="true" />
      ) : sorted === "desc" ? (
        <ArrowDown className="size-3" aria-hidden="true" />
      ) : (
        <ArrowUpDown className="size-3" aria-hidden="true" />
      )}
    </button>
  );
}
