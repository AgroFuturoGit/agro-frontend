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
      className="-mx-1 inline-flex items-center gap-1.5 rounded px-1 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
    >
      {title}
      {sorted === "asc" ? (
        <ArrowUp className="size-3.5" aria-hidden />
      ) : sorted === "desc" ? (
        <ArrowDown className="size-3.5" aria-hidden />
      ) : (
        <ArrowUpDown className="size-3.5 text-muted-foreground/50" aria-hidden />
      )}
    </button>
  );
}
