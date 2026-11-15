"use client";

import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type FilterOption = { value: string; label: string };

/**
 * Filtro dos painéis da Visão geral: rótulo acima do seletor (o `Label`
 * aponta para o `id` do gatilho, que é o nome acessível do combobox).
 */
export function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  disabled?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </Label>
      <Select
        value={value}
        disabled={disabled}
        onValueChange={(v) => onChange(v ?? options[0].value)}
      >
        <SelectTrigger id={id} className="w-full min-w-44 sm:w-48">
          <SelectValue>
            {(v) => options.find((o) => o.value === v)?.label ?? options[0].label}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Barra do painel: recorte atual à esquerda; filtros e "Exportar" à direita,
 * alinhados pela base (o botão fica na linha dos seletores).
 */
export function DashboardToolbar({
  heading,
  children,
  className,
}: {
  heading?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card
      data-testid="dashboard-toolbar"
      className={cn(
        "gap-4 p-4 lg:flex-row lg:items-end lg:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">{heading}</div>
      <div className="flex flex-wrap items-end gap-3">{children}</div>
    </Card>
  );
}
