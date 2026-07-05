"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api";
import { listCrops, type Crop } from "@/lib/crops";
import { listHarvests, type Harvest } from "@/lib/harvests";
import {
  createProductionPlan,
  updateProductionPlan,
  type ProductionPlan,
} from "@/lib/production";

type Mode = "create" | "edit";

type Props = {
  mode: Mode;
  producerId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  plan?: ProductionPlan | null;
};

type FormValues = {
  harvestId: string;
  cropId: string;
  plantedArea: string;
  expectedYield: string;
  plannedPlantingDate: string;
};

const EMPTY: FormValues = {
  harvestId: "",
  cropId: "",
  plantedArea: "",
  expectedYield: "",
  plannedPlantingDate: "",
};

function validate(values: FormValues, isCreate: boolean): Record<string, string> {
  const errors: Record<string, string> = {};
  if (isCreate && !values.harvestId) errors.harvestId = "Selecione a safra";
  if (isCreate && !values.cropId) errors.cropId = "Selecione o cultivo";
  const area = Number(values.plantedArea);
  if (!values.plantedArea || !Number.isFinite(area) || area <= 0) {
    errors.plantedArea = "Informe uma área maior que zero";
  }
  const yieldValue = Number(values.expectedYield);
  if (!values.expectedYield || !Number.isFinite(yieldValue) || yieldValue <= 0) {
    errors.expectedYield = "Informe um rendimento maior que zero";
  }
  return errors;
}

export function PlanFormDialog({
  mode,
  producerId,
  open,
  onOpenChange,
  onSaved,
  plan,
}: Props) {
  const isCreate = mode === "create";
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [crops, setCrops] = useState<Crop[]>([]);
  const [harvests, setHarvests] = useState<Harvest[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFormError(null);
    setFieldErrors({});
    if (mode === "edit" && plan) {
      setValues({
        harvestId: plan.harvest?.id ?? "",
        cropId: plan.crop?.id ?? "",
        plantedArea: String(plan.plantedArea ?? ""),
        expectedYield: String(plan.expectedYield ?? ""),
        plannedPlantingDate: plan.plannedPlantingDate ?? "",
      });
    } else {
      setValues(EMPTY);
    }
  }, [open, mode, plan]);

  useEffect(() => {
    if (!open || !isCreate) return;
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingOptions(true);
    Promise.all([listCrops(), listHarvests()])
      .then(([cropList, harvestList]) => {
        if (!active) return;
        setCrops(cropList);
        setHarvests(harvestList);
      })
      .catch(() => {
        if (active) setFormError("Não foi possível carregar cultivos e safras.");
      })
      .finally(() => {
        if (active) setLoadingOptions(false);
      });
    return () => {
      active = false;
    };
  }, [open, isCreate]);

  const isDirty = useMemo(() => {
    if (isCreate) return true;
    if (!plan) return false;
    return (
      values.plantedArea !== String(plan.plantedArea ?? "") ||
      values.expectedYield !== String(plan.expectedYield ?? "") ||
      values.plannedPlantingDate !== (plan.plannedPlantingDate ?? "")
    );
  }, [isCreate, values, plan]);

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
    if (formError) setFormError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const errors = validate(values, isCreate);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      const plantedArea = Number(values.plantedArea);
      const expectedYield = Number(values.expectedYield);
      const plannedPlantingDate = values.plannedPlantingDate || null;

      if (isCreate) {
        await createProductionPlan(producerId, {
          harvestId: values.harvestId,
          cropId: values.cropId,
          plantedArea,
          expectedYield,
          plannedPlantingDate,
        });
      } else if (plan) {
        await updateProductionPlan(plan.id, {
          plantedArea,
          expectedYield,
          plannedPlantingDate,
        });
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setFormError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível salvar o plano de produção.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const title = isCreate ? "Novo plano de produção" : "Editar plano";
  const description = isCreate
    ? "Planeje a safra vinculando cultivo, área e previsão de colheita."
    : "Atualize a estimativa e a data de plantio do plano.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div aria-live="polite">
            {formError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}
          </div>

          {isCreate ? (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="plan-harvest">Safra</Label>
                <Select
                  value={values.harvestId}
                  onValueChange={(v) => update("harvestId", v ?? "")}
                  disabled={submitting || loadingOptions}
                >
                  <SelectTrigger id="plan-harvest" className="w-full">
                    <SelectValue
                      placeholder={
                        loadingOptions ? "Carregando…" : "Selecione a safra"
                      }
                    >
                      {(v) =>
                        harvests.find((h) => h.id === v)?.label ??
                        "Selecione a safra"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {harvests.map((h) => (
                      <SelectItem key={h.id} value={h.id}>
                        {h.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldErrors.harvestId && (
                  <p className="text-sm text-destructive">
                    {fieldErrors.harvestId}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="plan-crop">Cultivo</Label>
                <Select
                  value={values.cropId}
                  onValueChange={(v) => update("cropId", v ?? "")}
                  disabled={submitting || loadingOptions}
                >
                  <SelectTrigger id="plan-crop" className="w-full">
                    <SelectValue
                      placeholder={
                        loadingOptions ? "Carregando…" : "Selecione o cultivo"
                      }
                    >
                      {(v) => {
                        const crop = crops.find((c) => c.id === v);
                        return crop
                          ? `${crop.name} — ${crop.variety}`
                          : "Selecione o cultivo";
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {crops.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} — {c.variety}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldErrors.cropId && (
                  <p className="text-sm text-destructive">{fieldErrors.cropId}</p>
                )}
              </div>
            </>
          ) : (
            plan && (
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                <p className="font-medium text-foreground">
                  {plan.crop
                    ? `${plan.crop.name} — ${plan.crop.variety}`
                    : "Cultivo"}
                </p>
                <p className="text-muted-foreground">
                  Safra: {plan.harvest?.label ?? "—"}
                </p>
              </div>
            )
          )}

          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="plan-area">Área plantada (ha)</Label>
              <Input
                id="plan-area"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                value={values.plantedArea}
                onChange={(e) => update("plantedArea", e.target.value)}
                required
                disabled={submitting}
                aria-invalid={Boolean(fieldErrors.plantedArea)}
              />
              {fieldErrors.plantedArea && (
                <p className="text-sm text-destructive">
                  {fieldErrors.plantedArea}
                </p>
              )}
            </div>

            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="plan-yield">Previsão de colheita (t)</Label>
              <Input
                id="plan-yield"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                value={values.expectedYield}
                onChange={(e) => update("expectedYield", e.target.value)}
                required
                disabled={submitting}
                aria-invalid={Boolean(fieldErrors.expectedYield)}
              />
              {fieldErrors.expectedYield && (
                <p className="text-sm text-destructive">
                  {fieldErrors.expectedYield}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="plan-planting-date">Data prevista de plantio</Label>
            <Input
              id="plan-planting-date"
              type="date"
              value={values.plannedPlantingDate}
              onChange={(e) => update("plannedPlantingDate", e.target.value)}
              disabled={submitting}
            />
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
            <Button type="submit" disabled={submitting || !isDirty}>
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" />
                  Salvando…
                </>
              ) : isCreate ? (
                "Salvar"
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
