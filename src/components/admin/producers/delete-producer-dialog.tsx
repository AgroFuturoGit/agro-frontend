"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

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
import { InlineAlert } from "@/components/ui/inline-alert";
import { ApiError } from "@/lib/api";
import { formatCpf } from "@/lib/cpf";
import {
  deleteProducer,
  producerDisplayName,
  type Producer,
} from "@/lib/producers";

/** Nome + CPF (quando houver): dois agricultores podem ter o mesmo nome. */
function producerIdentity(producer: Producer | null): string {
  if (!producer) return "o agricultor";
  const name = producerDisplayName(producer, "") || "o agricultor";
  const cpf = producer.cpf ?? producer.user?.cpf;
  return cpf ? `${name} (CPF ${formatCpf(cpf)})` : name;
}

type Props = {
  producer: Producer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
};

export function DeleteProducerDialog({
  producer,
  open,
  onOpenChange,
  onDeleted,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sempre que o diálogo abre, descarta o erro e o envio da abertura anterior.
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null);
    setSubmitting(false);
  }, [open]);

  async function handleConfirm() {
    if (!producer) return;
    setError(null);
    setSubmitting(true);
    try {
      await deleteProducer(producer.id);
      onDeleted();
      onOpenChange(false);
    } catch (err) {
      // Registro já removido: recarrega a lista para refletir o estado real.
      if (err instanceof ApiError && err.status === 404) onDeleted();
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível excluir o agricultor.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir agricultor</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação removerá{" "}
            <span className="font-medium text-foreground">
              {producerIdentity(producer)}
            </span>{" "}
            do sistema. Não é possível desfazer.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && <InlineAlert variant="destructive">{error}</InlineAlert>}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
                Excluindo…
              </>
            ) : (
              "Excluir"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
