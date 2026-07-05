"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { updateProducer, type Producer } from "@/lib/producers";

type Props = {
  producer: Producer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

export function ProducerFormDialog({
  producer,
  open,
  onOpenChange,
  onSaved,
}: Props) {
  const [aliasName, setAliasName] = useState("");
  const [isCompliant, setIsCompliant] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !producer) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null);
    setAliasName(producer.aliasName ?? "");
    setIsCompliant(producer.isCompliant ?? false);
  }, [open, producer]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!producer) return;
    setError(null);
    setSubmitting(true);
    try {
      const trimmed = aliasName.trim();
      await updateProducer(producer.id, {
        aliasName: trimmed === "" ? null : trimmed,
        isCompliant,
      });
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível salvar o produtor.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar produtor</DialogTitle>
          <DialogDescription>
            Atualize os dados do produtor{" "}
            <span className="font-medium text-foreground">
              {producer?.user?.fullName ?? ""}
            </span>
            .
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="aliasName">Nome/apelido</Label>
            <Input
              id="aliasName"
              value={aliasName}
              onChange={(e) => setAliasName(e.target.value)}
              disabled={submitting}
              placeholder="Como o produtor é conhecido"
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="isCompliant"
              checked={isCompliant}
              onCheckedChange={(checked) => setIsCompliant(checked === true)}
              disabled={submitting}
            />
            <Label htmlFor="isCompliant" className="font-normal">
              Produtor em conformidade
            </Label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" />
                  Salvando…
                </>
              ) : (
                "Salvar alterações"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
