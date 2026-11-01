"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { AlertCircle, Download, ImageOff, Loader2, Trash2, Upload } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_MAX_COUNT,
  ATTACHMENT_MESSAGES,
  deleteAttachment,
  downloadAttachment,
  formatFileSize,
  listAttachments,
  uploadAttachment,
  validateImageFile,
  type ExecutionAttachment,
} from "@/lib/attachments";
import { saveBlob } from "@/lib/download";
import { formatPlanDate, type ProductionExecution } from "@/lib/production";

type Props = {
  execution: ProductionExecution | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** ADMIN, TECHNICIAN e FARMER enviam e excluem; MANAGER e role desconhecida só veem e baixam. */
  canWrite: boolean;
};

/** Envio que não deu certo; `file` só existe quando vale tentar de novo (rede ou 5xx). */
type UploadFailure = { key: string; name: string; message: string; file: File | null };

const NO_ITEMS: ExecutionAttachment[] = [];

/** Recusa de validação (4xx) não melhora reenviando o mesmo arquivo. */
function isRetryable(err: unknown): boolean {
  return !(err instanceof ApiError) || err.status >= 500;
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

/**
 * Fotos de um apontamento de colheita. As imagens exigem o token, então cada
 * miniatura é baixada com `apiDownload` e exibida por Object URL, liberada ao
 * fechar o painel ou trocar de apontamento.
 */
export function ExecutionAttachmentsSheet({
  execution,
  open,
  onOpenChange,
  canWrite,
}: Props) {
  const executionId = execution?.id ?? null;

  // A lista guarda de qual apontamento veio: ao trocar de `executionId` ela some
  // no mesmo render, sem esperar o efeito, e nunca alimenta GETs com o id novo.
  const [loaded, setLoaded] = useState<{
    executionId: string;
    items: ExecutionAttachment[];
  } | null>(null);
  const items =
    loaded && loaded.executionId === executionId ? loaded.items : NO_ITEMS;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // id do anexo → Object URL da imagem; "error" quando a prévia falhou.
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [failures, setFailures] = useState<UploadFailure[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);

  const [viewTarget, setViewTarget] = useState<ExecutionAttachment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExecutionAttachment | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  // Sequência da última carga: respostas de outro apontamento ou antigas são descartadas.
  const loadSeq = useRef(0);
  // Sessão do sheet (abertura + apontamento): sobe ao fechar/trocar e descarta
  // o que um envio iniciado antes ainda tentar gravar no estado.
  const session = useRef(0);
  // Geração das miniaturas: sobe ao fechar/trocar e invalida downloads em andamento.
  const previewGen = useRef(0);
  const urls = useRef(new Map<string, string>());
  const pending = useRef(new Set<string>());

  const releasePreviews = useCallback(() => {
    previewGen.current += 1;
    for (const url of urls.current.values()) URL.revokeObjectURL(url);
    urls.current.clear();
    pending.current.clear();
  }, []);

  const refresh = useCallback(async () => {
    if (!executionId) return;
    const seq = ++loadSeq.current;
    setLoading(true);
    setError(null);
    try {
      const data = await listAttachments(executionId);
      if (seq === loadSeq.current) setLoaded({ executionId, items: data });
    } catch (err) {
      if (seq !== loadSeq.current) return;
      setError(
        err instanceof ApiError ? err.message : "Não foi possível carregar as fotos.",
      );
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [executionId]);

  useEffect(() => {
    if (!open || !executionId) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setPreviews({});
    setFailures([]);
    setUploading(false);
    setActionError(null);
    setViewTarget(null);
    setDeleteTarget(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    refresh();
    return () => {
      session.current += 1;
      loadSeq.current += 1;
      releasePreviews();
      setLoaded(null);
      setPreviews({});
    };
  }, [open, executionId, refresh, releasePreviews]);

  // Baixa (em paralelo) a imagem de cada anexo que ainda não tem prévia.
  useEffect(() => {
    if (!open || !executionId) return;
    const gen = previewGen.current;
    for (const item of items) {
      if (urls.current.has(item.id) || pending.current.has(item.id)) continue;
      pending.current.add(item.id);
      downloadAttachment(executionId, item.id, item.filename)
        .then(({ blob }) => {
          if (gen !== previewGen.current) return;
          const url = URL.createObjectURL(blob);
          urls.current.set(item.id, url);
          setPreviews((prev) => ({ ...prev, [item.id]: url }));
        })
        .catch(() => {
          if (gen !== previewGen.current) return;
          setPreviews((prev) => ({ ...prev, [item.id]: "error" }));
        })
        .finally(() => {
          if (gen === previewGen.current) pending.current.delete(item.id);
        });
    }
  }, [items, open, executionId]);

  async function sendFiles(files: File[]) {
    if (!executionId || files.length === 0) return;
    const mine = session.current;
    setActionError(null);
    setUploading(true);
    const failed: UploadFailure[] = [];
    let count = items.length;
    let sent = false;
    for (const file of files) {
      const invalid = validateImageFile(file, count);
      if (invalid) {
        failed.push({
          key: `${file.name}-${failed.length}`,
          name: file.name,
          message: `${file.name}: ${invalid}`,
          file: null,
        });
        continue;
      }
      try {
        await uploadAttachment(executionId, file);
        count += 1;
        sent = true;
      } catch (err) {
        failed.push({
          key: `${file.name}-${failed.length}`,
          name: file.name,
          message: `${file.name}: ${
            err instanceof ApiError ? err.message : "Não foi possível enviar a foto."
          }`,
          file: isRetryable(err) ? file : null,
        });
      }
    }
    // Fechou ou trocou de apontamento durante o envio: nada disto é do sheet atual.
    if (mine !== session.current) return;
    setFailures((prev) => [...prev, ...failed]);
    setUploading(false);
    if (sent) await refresh();
  }

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    setFailures([]);
    await sendFiles(files);
  }

  async function handleRetry(failure: UploadFailure) {
    if (!failure.file) return;
    const file = failure.file;
    setFailures((prev) => prev.filter((f) => f !== failure));
    await sendFiles([file]);
  }

  async function handleDownload(item: ExecutionAttachment) {
    if (!executionId) return;
    setActionError(null);
    try {
      const { blob, filename } = await downloadAttachment(
        executionId,
        item.id,
        item.filename,
      );
      saveBlob(blob, filename);
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Não foi possível baixar a foto.",
      );
    }
  }

  function dropPreview(id: string) {
    const url = urls.current.get(id);
    if (url) URL.revokeObjectURL(url);
    urls.current.delete(id);
    setPreviews((prev) => {
      const rest = { ...prev };
      delete rest[id];
      return rest;
    });
  }

  async function handleDelete() {
    if (!deleteTarget || !executionId) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      await deleteAttachment(executionId, deleteTarget.id);
      dropPreview(deleteTarget.id);
      setDeleteTarget(null);
      await refresh();
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 400)) {
        // Foto já removida por outra pessoa: some da lista.
        dropPreview(deleteTarget.id);
        setDeleteTarget(null);
        await refresh();
      } else {
        setDeleteError(
          err instanceof ApiError ? err.message : "Não foi possível excluir a foto.",
        );
      }
    } finally {
      setDeleting(false);
    }
  }

  function renderThumb(item: ExecutionAttachment) {
    const src = previews[item.id];
    if (!src) return <Skeleton className="aspect-square w-full rounded-lg" />;
    if (src === "error") {
      return (
        <div className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border bg-muted text-xs text-muted-foreground">
          <ImageOff className="size-5" />
          Prévia indisponível
        </div>
      );
    }
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Object URL local, não cabe no next/image
      <img
        src={src}
        alt={item.filename}
        className="aspect-square w-full rounded-lg border object-cover"
      />
    );
  }

  function renderList() {
    if (loading) {
      return (
        <div role="status" aria-label="Carregando fotos" className="grid grid-cols-2 gap-3">
          <Skeleton className="aspect-square w-full rounded-lg" />
          <Skeleton className="aspect-square w-full rounded-lg" />
        </div>
      );
    }
    if (error) {
      return (
        <div
          role="alert"
          className="flex items-start justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={refresh}>
            Tentar novamente
          </Button>
        </div>
      );
    }
    if (items.length === 0) {
      return (
        <p className="rounded-lg border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          Nenhuma foto anexada.
        </p>
      );
    }
    return (
      <ul className="grid grid-cols-2 gap-3">
        {items.map((item) => (
          <li key={item.id} className="flex min-w-0 flex-col gap-2 rounded-lg border bg-card p-2">
            <button
              type="button"
              aria-label={`Abrir ${item.filename}`}
              onClick={() => setViewTarget(item)}
              className="block w-full rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {renderThumb(item)}
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium" title={item.filename}>
                {item.filename}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(item.sizeBytes)} · {formatPlanDate(item.createdAt)}
              </p>
            </div>
            <div className="flex items-center justify-end gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Baixar ${item.filename}`}
                title="Baixar"
                onClick={() => handleDownload(item)}
              >
                <Download />
              </Button>
              {canWrite && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Excluir ${item.filename}`}
                  title="Excluir"
                  onClick={() => {
                    setDeleteError(null);
                    setDeleteTarget(item);
                  }}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 />
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    );
  }

  const description = execution
    ? `Apontamento de ${formatPlanDate(execution.harvestedAt)}: até ${ATTACHMENT_MAX_COUNT} fotos (JPEG, PNG ou WebP, até 5 MB cada).`
    : "";
  const atLimit = items.length >= ATTACHMENT_MAX_COUNT;
  const viewSrc = viewTarget ? previews[viewTarget.id] : undefined;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="data-[side=right]:w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Fotos do apontamento</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
          {canWrite && (
            <div className="flex flex-col items-start gap-2">
              <input
                ref={inputRef}
                type="file"
                accept={ATTACHMENT_ACCEPT}
                multiple
                hidden
                data-testid="attachment-input"
                onChange={handleFiles}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={uploading || atLimit || loading}
                onClick={() => inputRef.current?.click()}
              >
                {uploading ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Enviando…
                  </>
                ) : (
                  <>
                    <Upload />
                    Enviar fotos
                  </>
                )}
              </Button>
              {atLimit && (
                <p className="text-sm text-muted-foreground">{ATTACHMENT_MESSAGES.limit}</p>
              )}
            </div>
          )}

          <div aria-live="polite" className="flex flex-col gap-2">
            {failures.map((failure) => (
              <div key={failure.key} className="flex flex-col gap-1">
                <ErrorBox message={failure.message} />
                {failure.file && (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <strong>Falhou</strong>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={`Tentar novamente ${failure.name}`}
                      onClick={() => handleRetry(failure)}
                      disabled={uploading}
                    >
                      Tentar novamente
                    </Button>
                  </div>
                )}
              </div>
            ))}
            {actionError && <ErrorBox message={actionError} />}
          </div>

          {renderList()}
        </div>

        <Dialog
          open={viewTarget !== null}
          onOpenChange={(next) => {
            if (!next) setViewTarget(null);
          }}
        >
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="break-all">{viewTarget?.filename}</DialogTitle>
              <DialogDescription>
                {viewTarget
                  ? `${formatFileSize(viewTarget.sizeBytes)} · ${formatPlanDate(viewTarget.createdAt)}`
                  : ""}
              </DialogDescription>
            </DialogHeader>
            {viewSrc && viewSrc !== "error" ? (
              // eslint-disable-next-line @next/next/no-img-element -- Object URL local
              <img
                src={viewSrc}
                alt={viewTarget?.filename ?? ""}
                className="max-h-[70vh] w-full rounded-lg object-contain"
              />
            ) : (
              <p className="text-sm text-muted-foreground">Prévia indisponível.</p>
            )}
            {viewTarget && (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(viewTarget)}
                >
                  <Download />
                  Baixar
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {canWrite && (
          <AlertDialog
            open={deleteTarget !== null}
            onOpenChange={(next) => {
              if (!next && !deleting) setDeleteTarget(null);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir foto?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação removerá a foto{" "}
                  <span className="font-medium text-foreground">{deleteTarget?.filename}</span>{" "}
                  do apontamento. Não é possível desfazer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              {deleteError && <ErrorBox message={deleteError} />}
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Excluindo…
                    </>
                  ) : (
                    "Excluir"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </SheetContent>
    </Sheet>
  );
}
