"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
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
import { ApiError, apiErrorMessage, parseFieldErrors } from "@/lib/api";
import { harvestText } from "@/lib/harvest-label";
import { listCrops, type Crop } from "@/lib/crops";
import { listHarvests, type Harvest } from "@/lib/harvests";
import {
  PLAN_STATUSES,
  PLAN_STATUS_LABELS,
  createProductionPlan,
  formatNumber,
  formatPlanDate,
  planCropLabel,
  updateProductionPlan,
  type PlanStatus,
  type ProductionPlan,
} from "@/lib/production";
import { useFieldValidation } from "@/lib/use-field-validation";
import {
  DIGITS,
  MIN_POSITIVE_AMOUNT,
  digitsMessage,
  exceedsDigits,
  formatDecimalInput,
  parseDecimalBr,
} from "@/lib/validation";

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

type Field = keyof FormValues;
type FieldErrors = Partial<Record<Field, string>>;
type HarvestRange = { startDate: string | null; endDate: string | null };

const EMPTY: FormValues = {
  harvestId: "",
  cropId: "",
  plantedArea: "",
  status: "",
  expectedHarvestStart: "",
  expectedHarvestEnd: "",
  plannedPlantingDate: "",
};

const FIELDS = Object.keys(EMPTY) as Field[];

function parseStatus(value: string): PlanStatus | null {
  return PLAN_STATUSES.includes(value as PlanStatus) ? (value as PlanStatus) : null;
}

/** Meta em kg = área (ha) × produtividade (kg/ha); null se faltar dado. */
function computeTarget(area: string, productivity: number | null): number | null {
  const parsedArea = parseDecimalBr(area);
  if (!Number.isFinite(parsedArea) || parsedArea < MIN_POSITIVE_AMOUNT) return null;
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
  harvestRange: HarvestRange | null,
): FieldErrors {
  const errors: FieldErrors = {};
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
  const area = parseDecimalBr(values.plantedArea);
  if (!Number.isFinite(area) || area < MIN_POSITIVE_AMOUNT) {
    errors.plantedArea =
      "Informe uma área válida (use vírgula nos decimais; mínimo 0,01)";
  } else if (exceedsDigits(values.plantedArea, DIGITS.AMOUNT)) {
    errors.plantedArea = digitsMessage(DIGITS.AMOUNT.integer, DIGITS.AMOUNT.fraction);
  }
  // Plantio dentro do intervalo da safra (só valida o que a safra informa).
  // Na edição, só se a data mudou: dado antigo inalterado não bloqueia.
  const plantingChanged =
    isCreate || values.plannedPlantingDate !== (original?.plannedPlantingDate ?? "");
  if (values.plannedPlantingDate && harvestRange && plantingChanged) {
    const { startDate, endDate } = harvestRange;
    const before = startDate && values.plannedPlantingDate < startDate;
    const after = endDate && values.plannedPlantingDate > endDate;
    if (before || after) {
      errors.plannedPlantingDate = `O plantio deve estar dentro da safra (${formatPlanDate(startDate)} a ${formatPlanDate(endDate)})`;
    }
  }
  if (
    values.expectedHarvestStart &&
    values.expectedHarvestEnd &&
    values.expectedHarvestEnd < values.expectedHarvestStart
  ) {
    errors.expectedHarvestEnd = "A data final não pode ser anterior à data inicial";
  } else if (
    values.plannedPlantingDate &&
    values.expectedHarvestEnd &&
    values.expectedHarvestEnd < values.plannedPlantingDate
  ) {
    errors.expectedHarvestEnd = "A data final não pode ser anterior ao plantio";
  }
  return errors;
}

/** Erros por campo do 400 do back, só dos campos deste formulário. */
function serverFieldErrors(payload: unknown): FieldErrors {
  const parsed = parseFieldErrors(payload);
  const errors: FieldErrors = {};
  for (const field of FIELDS) {
    if (parsed[field]) errors[field] = parsed[field];
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
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [crops, setCrops] = useState<Crop[]>([]);
  const [harvests, setHarvests] = useState<Harvest[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  /**
   * Intervalo da safra escolhida (criação, a partir de `values.harvestId`) ou
   * já vinculada ao plano (edição). Sai dos valores recebidos, para o blur e a
   * digitação usarem a safra atual.
   */
  function rangeFor(current: FormValues): HarvestRange | null {
    return isCreate
      ? (harvests.find((h) => h.id === current.harvestId) ?? null)
      : (plan?.harvest ?? null);
  }

  const {
    errors: fieldErrors,
    onBlur,
    onChange,
    setErrors,
    reset,
  } = useFieldValidation<Field, FormValues>(
    (field, current) =>
      validate(current, isCreate, plan ?? null, rangeFor(current))[field],
  );

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFormError(null);
    reset();
    if (mode === "edit" && plan) {
      setValues({
        harvestId: plan.harvest?.id ?? "",
        cropId: plan.crop?.id ?? "",
        plantedArea: formatDecimalInput(plan.plantedArea),
        status: plan.status ?? "",
        expectedHarvestStart: plan.expectedHarvestStart ?? "",
        expectedHarvestEnd: plan.expectedHarvestEnd ?? "",
        plannedPlantingDate: plan.plannedPlantingDate ?? "",
      });
    } else {
      setValues(EMPTY);
    }
  }, [open, mode, plan, reset]);

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
      values.plantedArea !== formatDecimalInput(plan.plantedArea) ||
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

  function update<K extends Field>(key: K, value: FormValues[K]) {
    const next = { ...values, [key]: value };
    setValues(next);
    onChange(key, next);
    if (formError) setFormError(null);
  }

  /**
   * Select: o blur do trigger dispara ao abrir a lista, antes da escolha,
   * então o campo é validado ao escolher (os outros erros locais também são
   * recalculados, como na digitação).
   */
  function choose<K extends Field>(key: K, value: FormValues[K]) {
    update(key, value);
    onBlur(key, { ...values, [key]: value });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const errors = validate(values, isCreate, plan ?? null, rangeFor(values));
    if (cropWithoutProductivity) return;
    if (Object.keys(errors).length > 0) {
      setErrors(errors, "client");
      return;
    }

    setSubmitting(true);
    try {
      const plantedArea = parseDecimalBr(values.plantedArea);
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
      if (err instanceof ApiError) {
        const apiFieldErrors = serverFieldErrors(err.payload);
        if (Object.keys(apiFieldErrors).length > 0) {
          setErrors(apiFieldErrors, "server");
        }
      }
      setFormError(
        apiErrorMessage(err, "Não foi possível salvar o plano de produção."),
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
            {/* O role="alert" do InlineAlert já anuncia: sem aria-live em volta
                (evita anúncio duplicado). */}
            {formError && <InlineAlert variant="destructive">{formError}</InlineAlert>}

            {isCreate ? (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="plan-harvest">Safra</Label>
                  <Select
                    value={values.harvestId}
                    onValueChange={(v) => choose("harvestId", v ?? "")}
                    disabled={submitting || loadingOptions}
                  >
                    <SelectTrigger
                      id="plan-harvest"
                      className="w-full"
                      aria-invalid={Boolean(fieldErrors.harvestId)}
                      aria-describedby={fieldErrors.harvestId ? "plan-harvest-error" : undefined}
                    >
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
                    <p id="plan-harvest-error" className="text-sm text-destructive">
                      {fieldErrors.harvestId}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="plan-crop">Cultivo</Label>
                  <Select
                    value={values.cropId}
                    onValueChange={(v) => choose("cropId", v ?? "")}
                    disabled={submitting || loadingOptions}
                  >
                    <SelectTrigger
                      id="plan-crop"
                      className="w-full"
                      aria-invalid={Boolean(fieldErrors.cropId)}
                      aria-describedby={fieldErrors.cropId ? "plan-crop-error" : undefined}
                    >
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
                    <p id="plan-crop-error" className="text-sm text-destructive">{fieldErrors.cropId}</p>
                  )}
                </div>
              </>
            ) : (
              plan && (
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                  <p className="font-medium text-foreground">
                    {planCropLabel(plan) || "Cultivo"}
                  </p>
                  <p className="text-muted-foreground">
                    {harvestText(plan.harvest?.label)}
                  </p>
                </div>
              )
            )}

            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor="plan-area">Área plantada (ha)</Label>
                <Input
                  id="plan-area"
                  type="text"
                  inputMode="decimal"
                  value={values.plantedArea}
                  onChange={(e) => update("plantedArea", e.target.value)}
                  onBlur={() => onBlur("plantedArea", values)}
                  required
                  disabled={submitting}
                  aria-invalid={Boolean(fieldErrors.plantedArea)}
                  aria-describedby={fieldErrors.plantedArea ? "plan-area-error" : undefined}
                />
                {fieldErrors.plantedArea && (
                  <p id="plan-area-error" className="text-sm text-destructive">
                    {fieldErrors.plantedArea}
                  </p>
                )}
              </div>
            </div>

            {cropWithoutProductivity && (
              <InlineAlert variant="warning">
                Esta cultura não tem produtividade esperada. Complete o
                cadastro da cultura antes de criar o plano.
              </InlineAlert>
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
                  onBlur={() => onBlur("expectedHarvestStart", values)}
                  disabled={submitting}
                  aria-invalid={Boolean(fieldErrors.expectedHarvestStart)}
                  aria-describedby={fieldErrors.expectedHarvestStart ? "plan-harvest-start-error" : undefined}
                />
                {fieldErrors.expectedHarvestStart && (
                  <p id="plan-harvest-start-error" className="text-sm text-destructive">
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
                  onBlur={() => onBlur("expectedHarvestEnd", values)}
                  disabled={submitting}
                  aria-invalid={Boolean(fieldErrors.expectedHarvestEnd)}
                  aria-describedby={fieldErrors.expectedHarvestEnd ? "plan-harvest-end-error" : undefined}
                />
                {fieldErrors.expectedHarvestEnd && (
                  <p id="plan-harvest-end-error" className="text-sm text-destructive">
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
                onBlur={() => onBlur("plannedPlantingDate", values)}
                disabled={submitting}
                aria-invalid={Boolean(fieldErrors.plannedPlantingDate)}
                aria-describedby={fieldErrors.plannedPlantingDate ? "plan-planting-date-error" : undefined}
              />
              {fieldErrors.plannedPlantingDate && (
                <p id="plan-planting-date-error" className="text-sm text-destructive">
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
                  <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
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
