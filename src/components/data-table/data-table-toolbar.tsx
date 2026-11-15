"use client";

import { useEffect, useState } from "react";
import type { Table as ReactTableInstance } from "@tanstack/react-table";
import { ChevronDown, Funnel, Search, X } from "lucide-react";

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
import { cn } from "@/lib/utils";

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
  /**
   * Controles extras na mesma linha da busca e do "Filtros" (ex.: o
   * checkbox "Somente prioritárias" de Culturas). Quebra linha no mobile.
   */
  extra?: React.ReactNode;
  /**
   * Filtro controlado fora do `filters` (ex.: checkbox do `extra`). Quando
   * `active`, entra na linha de chips (com `label`) e é limpo pelo "Limpar",
   * para o "Limpar" da toolbar ter o mesmo alcance do "Limpar filtros" do
   * estado vazio.
   */
  extraFilter?: { active: boolean; label: string; onClear: () => void };
};

const CHIP_CLASS =
  "inline-flex h-control-sm items-center gap-1 rounded-full bg-muted px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none";

export function DataTableToolbar<TData>({
  table,
  searchPlaceholder = "Buscar…",
  filters = [],
  extra,
  extraFilter,
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

  // Valor efetivamente aplicado ao `globalFilter` da tabela — só é setado
  // quando a regra "0 ou 3+ caracteres" (ver useEffect acima) permite
  // propagar. Diferente de `rawSearch`, que reflete o que está sendo
  // digitado agora, ainda sem passar pela regra.
  const appliedSearch = (table.getState().globalFilter as string | undefined) ?? "";

  const extraFilterActive = Boolean(extraFilter?.active);
  const hasAnyActiveFilter =
    Boolean(appliedSearch) || activeColumnFilters.length > 0 || extraFilterActive;

  function clearAll() {
    clearSearch();
    filters.forEach((f) => table.getColumn(f.columnId)?.setFilterValue(undefined));
    if (extraFilterActive) extraFilter?.onClear();
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-64">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={rawSearch}
            placeholder={searchPlaceholder}
            // O placeholder some ao digitar: o nome acessível vem do aria-label.
            aria-label={searchPlaceholder.replace(/…$/, "").trim() || "Buscar na tabela"}
            className="pl-8"
            onChange={(e) => setRawSearch(e.target.value)}
          />
        </div>
        {filters.length > 0 && (
          <Button
            type="button"
            variant="outline"
            className="gap-2 border-input px-3 text-foreground"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((v) => !v)}
          >
            <Funnel className="size-3.5" aria-hidden="true" />
            Filtros
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "size-3.5 transition-transform motion-reduce:transition-none",
                filtersOpen && "rotate-180",
              )}
            />
          </Button>
        )}
        {extra}
      </div>

      {hasAnyActiveFilter && (
        <div className="flex flex-wrap items-center gap-2">
          {appliedSearch && (
            <button
              type="button"
              onClick={clearSearch}
              // O nome diz a ação (remover) e contém o texto visível do chip.
              aria-label={`Remover filtro Busca: ${appliedSearch}`}
              className={CHIP_CLASS}
            >
              Busca: {appliedSearch} <X className="size-3" aria-hidden="true" />
            </button>
          )}
          {activeColumnFilters.map(({ filter, value }) => {
            const valueLabel =
              filter.options.find((o) => o.value === value)?.label ?? value;
            return (
              <button
                key={filter.columnId}
                type="button"
                onClick={() => table.getColumn(filter.columnId)?.setFilterValue(undefined)}
                aria-label={`Remover filtro ${filter.label}: ${valueLabel}`}
                className={CHIP_CLASS}
              >
                {filter.label}: {valueLabel}{" "}
                <X className="size-3" aria-hidden="true" />
              </button>
            );
          })}
          {extraFilterActive && extraFilter && (
            <button
              type="button"
              onClick={extraFilter.onClear}
              aria-label={`Remover filtro ${extraFilter.label}`}
              className={CHIP_CLASS}
            >
              {extraFilter.label} <X className="size-3" aria-hidden="true" />
            </button>
          )}
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
                  className="text-xs font-medium text-muted-foreground"
                >
                  {filter.label}
                </label>
                <Select
                  value={currentValue}
                  onValueChange={(v) =>
                    table.getColumn(filter.columnId)?.setFilterValue(v === "all" ? undefined : v)
                  }
                >
                  <SelectTrigger id={`data-table-filter-${filter.columnId}`} className="w-44">
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
