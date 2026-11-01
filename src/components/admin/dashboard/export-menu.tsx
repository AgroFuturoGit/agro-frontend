"use client";

import { useRef, useState } from "react";
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
  const running = useRef(false);

  async function run(format: ExportFormat) {
    if (running.current) return;
    running.current = true;
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
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={disabled || busy}
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
