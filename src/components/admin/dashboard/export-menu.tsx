"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, ChevronDown, Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ExportFormat } from "@/lib/analytics";
import { ApiError, type DownloadResult } from "@/lib/api";
import { saveBlob } from "@/lib/download";

const FALLBACK_ERROR = "Não foi possível gerar o relatório.";

/**
 * Botão "Exportar" dos painéis da Visão geral: PDF ou Excel com os filtros que
 * o painel passa em `onExport`. O arquivo é gerado pelo back; aqui só se baixa.
 */
export function ExportMenu({
  onExport,
  disabled = false,
}: {
  onExport: (format: ExportFormat) => Promise<DownloadResult>;
  /** Painel carregando ou em erro de carga. */
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const running = useRef(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasBusy = useRef(false);

  // Ao terminar a geração o foco volta ao botão (ele não fica `disabled`
  // durante `busy`, só `aria-disabled`, para não perdê-lo).
  useEffect(() => {
    if (wasBusy.current && !busy) triggerRef.current?.focus();
    wasBusy.current = busy;
  }, [busy]);

  async function run(format: ExportFormat) {
    if (running.current) return;
    running.current = true;
    setOpen(false);
    setBusy(true);
    setError(null);
    try {
      const { blob, filename } = await onExport(format);
      saveBlob(blob, filename);
    } catch (err) {
      setError(err instanceof ApiError && err.message ? err.message : FALLBACK_ERROR);
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-col items-end gap-1">
      <DropdownMenu
        open={open && !busy}
        onOpenChange={(next) => {
          if (!busy) setOpen(next);
        }}
      >
        <DropdownMenuTrigger
          ref={triggerRef}
          disabled={disabled}
          aria-disabled={busy || undefined}
          aria-busy={busy}
          aria-label="Exportar relatório"
          render={<Button type="button" variant="outline" />}
        >
          {busy ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <Download aria-hidden />
          )}
          {busy ? "Gerando…" : "Exportar"}
          <ChevronDown aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          <DropdownMenuItem onClick={() => void run("pdf")}>PDF</DropdownMenuItem>
          <DropdownMenuItem onClick={() => void run("xlsx")}>
            Excel (.xlsx)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {error && (
        <p
          role="alert"
          className="flex max-w-full items-start gap-1 text-xs text-destructive"
        >
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
