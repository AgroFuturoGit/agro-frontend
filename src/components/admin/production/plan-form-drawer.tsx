"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  PLAN_STATUSES,
  PLAN_STATUS_LABELS,
  createProductionPlan,
  formatNumber,
  updateProductionPlan,
  type PlanStatus,
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
  status: string;
  expectedHarvestStart: string;
  expectedHarvestEnd: string;
  plannedPlantingDate: string;
};

const EMPTY: FormValues = {
  harvestId: "",
  cropId: "",
  plantedArea: "",
  status: "",
  expectedHarvestStart: "",
  expectedHarvestEnd: "",
  plannedPlantingDate: "",
};

function parseStatus(value: string): PlanStatus | null {
  return PLAN_STATUSES.includes(value as PlanStatus) ? (value as PlanStatus) : null;
}

/** Meta em kg = área (ha) × produtividade (kg/ha); null se faltar dado. */
function computeTarget(area: string, productivity: number | null): number | null {
  const parsedArea = Number(area);
  if (!area || !Number.isFinite(parsedArea) || parsedArea <= 0) return null;
  if (productivity === null || productivity <= 0) return null;
  return parsedArea * productivity;
}

const CLEARABLE_DATE_FIELDS = [
  "expectedHarvestStart",
  "expectedHarvestEnd",
  "plannedPlantingDate",
] as const;

function validate(
  values: FormValues,
  isCreate: boolean,
  original: ProductionPlan | null,
): Record<string, string> {
  const errors: Record<string, string> = {};
  // No PUT, data null = "manter valor atual": esvaziar o campo não apagaria
  // nada e o valor antigo voltaria após salvar (CR-002).
  if (!isCreate && original) {
    for (const field of CLEARABLE_DATE_FIELDS) {
      if (original[field] && !values[field]) {
        errors[field] =
          "Não é possível remover esta data depois de definida; altere para outra data";
      }
    }
  }
  if (isCreate && !values.harvestId) errors.harvestId = "Selecione a safra";
  if (isCreate && !values.cropId) errors.cropId = "Selecione o cultivo";
  const area = Number(values.plantedArea);
  if (!values.plantedArea || !Number.isFinite(area) || area <= 0) {
    errors.plantedArea = "Informe uma área maior que zero";
  }
  if (
    values.expectedHarvestStart &&
    values.expectedHarvestEnd &&
    values.expectedHarvestEnd < values.expectedHarvestStart
  ) {
    errors.expectedHarvestEnd = "A data final não pode ser anterior à data inicial";
  }
  return errors;
}

export function PlanFormDrawer({
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
        status: plan.status ?? "",
        expectedHarvestStart: plan.expectedHarvestStart ?? "",
        expectedHarvestEnd: plan.expectedHarvestEnd ?? "",
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
      values.status !== (plan.status ?? "") ||
      values.expectedHarvestStart !== (plan.expectedHarvestStart ?? "") ||
      values.expectedHarvestEnd !== (plan.expectedHarvestEnd ?? "") ||
      values.plannedPlantingDate !== (plan.plannedPlantingDate ?? "")
    );
  }, [isCreate, values, plan]);

  const selectedCrop = useMemo(
    () => crops.find((c) => c.id === values.cropId) ?? null,
    [crops, values.cropId],
  );
  // Criação: produtividade da cultura escolhida. Edição: a já copiada no plano.
  const productivity = isCreate
    ? (selectedCrop?.expectedProductivity ?? null)
    : (plan?.expectedProductivity ?? null);
  const target = computeTarget(values.plantedArea, productivity);
  // BR-004: cultura sem produtividade > 0 não gera plano (o back devolveria 400).
  const cropWithoutProductivity =
    isCreate &&
    selectedCrop !== null &&
    (selectedCrop.expectedProductivity ?? 0) <= 0;

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

    const errors = validate(values, isCreate, plan ?? null);
    if (cropWithoutProductivity) return;
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      const plantedArea = Number(values.plantedArea);
      const plannedPlantingDate = values.plannedPlantingDate || null;
      const expectedHarvestStart = values.expectedHarvestStart || null;
      const expectedHarvestEnd = values.expectedHarvestEnd || null;

      if (isCreate) {
        await createProductionPlan(producerId, {
          harvestId: values.harvestId,
          cropId: values.cropId,
          plantedArea,
          expectedHarvestStart,
          expectedHarvestEnd,
          plannedPlantingDate,
        });
      } else if (plan) {
        // No PUT, campo null = "manter valor atual" (não dá para limpar data).
        await updateProductionPlan(plan.id, {
          plantedArea,
          status: parseStatus(values.status),
          expectedHarvestStart,
          expectedHarvestEnd,
          expectedProductivity: plan.expectedProductivity,
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
    : "Atualize área, status, janela de colheita e data de plantio do plano.";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

        <form
          noValidate
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col overflow-y-auto"
        >
          <div className="flex flex-1 flex-col gap-4 px-4 pb-4">
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
            </div>

            {cropWithoutProductivity && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>
                  Esta cultura não tem produtividade esperada. Complete o
                  cadastro da cultura antes de criar o plano.
                </span>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="plan-target">Meta prevista</Label>
              <Input
                id="plan-target"
                readOnly
                value={target === null ? "—" : `${formatNumber(target)} kg`}
              />
              <p className="text-xs text-muted-foreground">
                Área × produtividade esperada da cultura
                {productivity !== null && productivity > 0
                  ? ` (${formatNumber(productivity)} kg/ha)`
                  : ""}
                .
              </p>
            </div>

            {!isCreate && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="plan-status">Status</Label>
                <Select
                  value={values.status}
                  onValueChange={(v) => update("status", v ?? "")}
                  disabled={submitting}
                >
                  <SelectTrigger id="plan-status" className="w-full">
                    <SelectValue placeholder="Selecione o status">
                      {(v) => {
                        const status = parseStatus(String(v ?? ""));
                        return status
                          ? PLAN_STATUS_LABELS[status]
                          : "Selecione o status";
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {PLAN_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {PLAN_STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor="plan-harvest-start">Início previsto da colheita</Label>
                <Input
                  id="plan-harvest-start"
                  type="date"
                  value={values.expectedHarvestStart}
                  onChange={(e) => update("expectedHarvestStart", e.target.value)}
                  disabled={submitting}
                  aria-invalid={Boolean(fieldErrors.expectedHarvestStart)}
                />
                {fieldErrors.expectedHarvestStart && (
                  <p className="text-sm text-destructive">
                    {fieldErrors.expectedHarvestStart}
                  </p>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor="plan-harvest-end">Fim previsto da colheita</Label>
                <Input
                  id="plan-harvest-end"
                  type="date"
                  value={values.expectedHarvestEnd}
                  onChange={(e) => update("expectedHarvestEnd", e.target.value)}
                  disabled={submitting}
                  aria-invalid={Boolean(fieldErrors.expectedHarvestEnd)}
                />
                {fieldErrors.expectedHarvestEnd && (
                  <p className="text-sm text-destructive">
                    {fieldErrors.expectedHarvestEnd}
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
                aria-invalid={Boolean(fieldErrors.plannedPlantingDate)}
              />
              {fieldErrors.plannedPlantingDate && (
                <p className="text-sm text-destructive">
                  {fieldErrors.plannedPlantingDate}
                </p>
              )}
            </div>
          </div>

          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={submitting || !isDirty || cropWithoutProductivity}
            >
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
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
