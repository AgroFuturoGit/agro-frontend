"use client";

import { useEffect, useState } from "react";
import type { Table as ReactTableInstance } from "@tanstack/react-table";
import { ChevronDown, Filter, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

type ToolbarFilter = {
  columnId: string;
  label: string;
  options: { value: string; label: string }[];
};

type DataTableToolbarProps<TData> = {
  /** Instância já criada pelo chamador via `useReactTable` — nunca criada aqui. */
  table: ReactTableInstance<TData>;
  searchPlaceholder?: string;
  filters?: ToolbarFilter[];
};

export function DataTableToolbar<TData>({
  table,
  searchPlaceholder = "Buscar…",
  filters = [],
}: DataTableToolbarProps<TData>) {
  const [rawSearch, setRawSearch] = useState("");
  const debouncedSearch = useDebouncedValue(rawSearch, 500);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // A regra "só propaga com 0 ou 3+ caracteres" é responsabilidade de quem
  // consome `useDebouncedValue` (genérico), não do hook em si.
  useEffect(() => {
    if (debouncedSearch.length === 0 || debouncedSearch.length >= 3) {
      table.setGlobalFilter(debouncedSearch);
    }
  }, [debouncedSearch, table]);

  function clearSearch() {
    setRawSearch("");
    table.setGlobalFilter("");
  }

  const activeColumnFilters = filters
    .map((f) => ({
      filter: f,
      value: table.getColumn(f.columnId)?.getFilterValue() as
        | string
        | undefined,
    }))
    .filter((entry) => Boolean(entry.value));

  const hasAnyActiveFilter = Boolean(rawSearch) || activeColumnFilters.length > 0;

  function clearAll() {
    clearSearch();
    filters.forEach((f) => table.getColumn(f.columnId)?.setFilterValue(undefined));
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={rawSearch}
            placeholder={searchPlaceholder}
            className="pl-8"
            onChange={(e) => setRawSearch(e.target.value)}
          />
        </div>
        {filters.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((v) => !v)}
          >
            <Filter className="size-4" />
            Filtros
            <ChevronDown
              className={`size-4 transition-transform ${filtersOpen ? "rotate-180" : ""}`}
            />
          </Button>
        )}
      </div>

      {hasAnyActiveFilter && (
        <div className="flex flex-wrap items-center gap-2">
          {rawSearch && (
            <button
              type="button"
              onClick={clearSearch}
              className="inline-flex h-7 items-center gap-1 rounded-full bg-muted px-2.5 text-xs font-medium hover:bg-accent"
            >
              Busca: {rawSearch} <X className="size-3" />
            </button>
          )}
          {activeColumnFilters.map(({ filter, value }) => (
            <button
              key={filter.columnId}
              type="button"
              onClick={() => table.getColumn(filter.columnId)?.setFilterValue(undefined)}
              className="inline-flex h-7 items-center gap-1 rounded-full bg-muted px-2.5 text-xs font-medium hover:bg-accent"
            >
              {filter.label}: {filter.options.find((o) => o.value === value)?.label ?? value}{" "}
              <X className="size-3" />
            </button>
          ))}
          <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
            Limpar
          </Button>
        </div>
      )}

      {filtersOpen && filters.length > 0 && (
        <div className="flex flex-wrap items-end gap-3 border-t pt-3">
          {filters.map((filter) => {
            const currentValue =
              (table.getColumn(filter.columnId)?.getFilterValue() as string | undefined) ??
              "all";
            const currentLabel = filter.options.find((o) => o.value === currentValue)?.label;

            return (
              <div key={filter.columnId} className="flex flex-col gap-1">
                <label
                  htmlFor={`data-table-filter-${filter.columnId}`}
                  className="text-xs font-semibold text-muted-foreground"
                >
                  {filter.label}
                </label>
                <Select
                  value={currentValue}
                  onValueChange={(v) =>
                    table.getColumn(filter.columnId)?.setFilterValue(v === "all" ? undefined : v)
                  }
                >
                  <SelectTrigger id={`data-table-filter-${filter.columnId}`} className="h-9 w-44">
                    <SelectValue placeholder="Todos">
                      {() => currentLabel ?? "Todos"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {filter.options.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
