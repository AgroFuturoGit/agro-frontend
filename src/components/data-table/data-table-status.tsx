"use client";

import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

type DataTableStatusProps = {
  icon: LucideIcon;
  title: string;
  hint: string;
  actionLabel?: string;
  onAction?: () => void;
  /**
   * `alert` interrompe o leitor de tela (usar só em erro); `status` é o
   * anúncio educado dos estados vazios. Nunca trocar os dois.
   */
  role?: "status" | "alert";
};

export function DataTableStatus({
  icon: Icon,
  title,
  hint,
  actionLabel,
  onAction,
  role = "status",
}: DataTableStatusProps) {
  return (
    <div
      role={role}
      className="flex flex-col items-center justify-center gap-1 px-6 py-16 text-center"
    >
      <div className="mb-3 flex size-16 items-center justify-center rounded-2xl bg-muted">
        <Icon className="size-8 text-muted-foreground" />
      </div>
      <p className="text-base font-semibold text-foreground">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{hint}</p>
      {actionLabel && onAction ? (
        <Button type="button" variant="outline" className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
