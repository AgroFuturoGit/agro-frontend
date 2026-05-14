"use client";

import { useSyncExternalStore } from "react";
import { Loader2 } from "lucide-react";

import { loadingStore } from "@/lib/loading-store";

export function LoadingOverlay() {
  const count = useSyncExternalStore(
    loadingStore.subscribe,
    loadingStore.getSnapshot,
    () => 0,
  );

  if (count === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/60 backdrop-blur-sm"
    >
      <Loader2 className="size-8 animate-spin text-primary" />
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
