"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  HARVEST_TYPES,
  HARVEST_TYPE_LABELS,
  MEASUREMENT_UNITS,
  UNIT_NAMES,
  createCrop,
  parseCropFieldErrors,
  parseHarvestType,
  parseMeasurementUnit,
  updateCrop,
  type Crop,
  type CropWritePayload,
  type MeasurementUnit,
} from "@/lib/crops";
import {
  NAME_MIN_LENGTH_MESSAGE,
  TEXT_MAX_LENGTH,
  formatDecimalInput,
  isPositiveIntegerDigits,
  parseDecimalBr,
} from "@/lib/validation";

type Mode = "create" | "edit";

type Props = {
  mode: Mode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  crop?: Crop | null;
};

type FormValues = {
  name: string;
  variety: string;
  isPriority: boolean;
  cycleDays: string;
  expectedProductivity: string;
  harvestType: string;
  unit: string;
  unitWeightKg: string;
};

const EMPTY: FormValues = {
  name: "",
  variety: "",
  isPriority: false,
  cycleDays: "",
  expectedProductivity: "",
  harvestType: "",
  unit: "",
  unitWeightKg: "",
};

/** KG e TON têm peso fixo (1 e 1000); SACK/BOX exigem o peso informado. */
const FIXED_UNIT_WEIGHT: Partial<Record<MeasurementUnit, string>> = {
  KG: "1",
  TON: "1000",
};

function toFormValues(crop: Crop): FormValues {
  return {
    name: crop.name,
    variety: crop.variety,
    isPriority: crop.isPriority,
    cycleDays: crop.cycleDays === null ? "" : String(crop.cycleDays),
    expectedProductivity:
      formatDecimalInput(crop.expectedProductivity),
    harvestType: crop.harvestType ?? "",
    unit: crop.unit ?? "",
    unitWeightKg: formatDecimalInput(crop.unitWeightKg),
  };
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function validateField(field: keyof FormValues, value: FormValues): string | null {
  switch (field) {
    case "name":
    case "variety": {
      const trimmed = value[field].trim();
      if (field === "name") {
        if (trimmed.length === 0) return "Informe o nome da cultura";
        if (trimmed.length < 2) return NAME_MIN_LENGTH_MESSAGE;
        return null;
      }
      return trimmed.length < 2 ? "Informe a variedade" : null;
    }
    case "cycleDays": {
      if (!value.cycleDays.trim()) return null; // opcional
      if (!isPositiveIntegerDigits(value.cycleDays)) {
        return "Informe um número inteiro de dias maior que zero";
      }
      return null;
    }
    case "expectedProductivity": {
      const productivity = parseDecimalBr(value.expectedProductivity);
      if (!Number.isFinite(productivity) || productivity <= 0) {
        return "Informe uma produtividade maior que zero";
      }
      return null;
    }
    case "harvestType":
      return parseHarvestType(value.harvestType)
        ? null
        : "Selecione o tipo de colheita";
    case "unit":
      return parseMeasurementUnit(value.unit) ? null : "Selecione a unidade";
    case "unitWeightKg": {
      const unit = parseMeasurementUnit(value.unit);
      if (unit !== "SACK" && unit !== "BOX") return null;
      const weight = parseDecimalBr(value.unitWeightKg);
      if (!Number.isFinite(weight) || weight <= 0) {
        return "Informe o peso da unidade (maior que zero)";
      }
      return null;
    }
    default:
      return null;
  }
}

const VALIDATED_FIELDS: (keyof FormValues)[] = [
  "name",
  "variety",
  "cycleDays",
  "expectedProductivity",
  "harvestType",
  "unit",
  "unitWeightKg",
];

function validateAll(values: FormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of VALIDATED_FIELDS) {
    const error = validateField(field, values);
    if (error) errors[field] = error;
  }
  return errors;
}

function buildPayload(values: FormValues): CropWritePayload {
  const unit = parseMeasurementUnit(values.unit);
  const fixedWeight = unit ? FIXED_UNIT_WEIGHT[unit] : undefined;
  return {
    name: values.name.trim(),
    variety: values.variety.trim(),
    isPriority: values.isPriority,
    cycleDays: values.cycleDays.trim() ? Number(values.cycleDays.trim()) : null,
    expectedProductivity: parseDecimalBr(values.expectedProductivity),
    harvestType: parseHarvestType(values.harvestType),
    unit,
    unitWeightKg: parseDecimalBr(fixedWeight ?? values.unitWeightKg),
  };
}

export function CropFormDrawer({
  mode,
  open,
  onOpenChange,
  onSaved,
  crop,
}: Props) {
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [initialValues, setInitialValues] = useState<FormValues>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFormError(null);
    setFieldErrors({});
    if (mode === "edit" && crop) {
      const next = toFormValues(crop);
      setValues(next);
      setInitialValues(next);
    } else {
      setValues(EMPTY);
      setInitialValues(EMPTY);
    }
  }, [open, mode, crop]);

  const isDirty = useMemo(() => {
    if (mode !== "edit") return true;
    return (Object.keys(values) as (keyof FormValues)[]).some((key) => {
      const current = values[key];
      const initial = initialValues[key];
      return typeof current === "string" && typeof initial === "string"
        ? current.trim() !== initial.trim()
        : current !== initial;
    });
  }, [mode, values, initialValues]);

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

  function handleUnitChange(next: string) {
    const unit = parseMeasurementUnit(next);
    setValues((prev) => {
      const fixed = unit ? FIXED_UNIT_WEIGHT[unit] : undefined;
      const prevUnit = parseMeasurementUnit(prev.unit);
      const prevWasFixed = prevUnit ? FIXED_UNIT_WEIGHT[prevUnit] !== undefined : true;
      return {
        ...prev,
        unit: next,
        // KG/TON preenchem o peso sozinhos; ao sair de um fixo para
        // SACK/BOX o campo começa vazio para o usuário informar.
        unitWeightKg: fixed ?? (prevWasFixed ? "" : prev.unitWeightKg),
      };
    });
    setFieldErrors((prev) => {
      const nextErrors = { ...prev };
      delete nextErrors.unit;
      delete nextErrors.unitWeightKg;
      return nextErrors;
    });
    if (formError) setFormError(null);
  }

  function handleBlur(field: keyof FormValues) {
    const error = validateField(field, values);
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (error) next[field] = error;
      else delete next[field];
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const clientErrors = validateAll(values);
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      return;
    }

    setSubmitting(true);
    try {
      // O PATCH substitui tudo: SEMPRE envia os 8 campos de escrita.
      const payload = buildPayload(values);
      if (mode === "create") {
        await createCrop(payload);
      } else if (crop) {
        await updateCrop(crop.id, payload);
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError) {
        const apiFieldErrors = parseCropFieldErrors(err.payload);
        if (Object.keys(apiFieldErrors).length > 0) {
          setFieldErrors(apiFieldErrors);
        }
        setFormError(err.message);
      } else {
        setFormError("Não foi possível salvar a cultura.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const isCreate = mode === "create";
  const selectedUnit = parseMeasurementUnit(values.unit);
  const unitWeightLocked =
    selectedUnit !== null && FIXED_UNIT_WEIGHT[selectedUnit] !== undefined;
  const title = isCreate ? "Nova cultura" : "Editar cultura";
  const description = isCreate
    ? "Cadastre uma nova cultura agrícola."
    : "Atualize os dados da cultura selecionada.";

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

            {!isCreate && crop && (
              <>
                <p className="text-xs text-muted-foreground">
                  Última atualização: {formatDateTime(crop.updatedAt)}
                </p>
              </>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="crop-name">Nome da cultura</Label>
              <Input
                id="crop-name"
                value={values.name}
                onChange={(e) => update("name", e.target.value)}
                onBlur={() => handleBlur("name")}
                required
                maxLength={TEXT_MAX_LENGTH}
                disabled={submitting}
                aria-invalid={Boolean(fieldErrors.name)}
              />
              {fieldErrors.name && (
                <p className="text-sm text-destructive">{fieldErrors.name}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="crop-variety">Variedade</Label>
              <Input
                id="crop-variety"
                value={values.variety}
                onChange={(e) => update("variety", e.target.value)}
                onBlur={() => handleBlur("variety")}
                required
                maxLength={TEXT_MAX_LENGTH}
                disabled={submitting}
                aria-invalid={Boolean(fieldErrors.variety)}
              />
              {fieldErrors.variety && (
                <p className="text-sm text-destructive">{fieldErrors.variety}</p>
              )}
            </div>

            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor="crop-productivity">
                  Produtividade esperada (kg/ha)
                </Label>
                <Input
                  id="crop-productivity"
                  type="text"
                  inputMode="decimal"
                  value={values.expectedProductivity}
                  onChange={(e) => update("expectedProductivity", e.target.value)}
                  onBlur={() => handleBlur("expectedProductivity")}
                  disabled={submitting}
                  aria-invalid={Boolean(fieldErrors.expectedProductivity)}
                />
                {fieldErrors.expectedProductivity && (
                  <p className="text-sm text-destructive">
                    {fieldErrors.expectedProductivity}
                  </p>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor="crop-cycle">Ciclo (dias) — opcional</Label>
                <Input
                  id="crop-cycle"
                  type="text"
                  inputMode="numeric"
                  value={values.cycleDays}
                  onChange={(e) => update("cycleDays", e.target.value)}
                  onBlur={() => handleBlur("cycleDays")}
                  disabled={submitting}
                  aria-invalid={Boolean(fieldErrors.cycleDays)}
                />
                {fieldErrors.cycleDays && (
                  <p className="text-sm text-destructive">{fieldErrors.cycleDays}</p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="crop-harvest-type">Tipo de colheita</Label>
              <Select
                value={values.harvestType}
                onValueChange={(v) => update("harvestType", v ?? "")}
                disabled={submitting}
              >
                <SelectTrigger
                  id="crop-harvest-type"
                  className="w-full"
                  aria-invalid={Boolean(fieldErrors.harvestType)}
                >
                  <SelectValue placeholder="Selecione o tipo de colheita">
                    {(v) => {
                      const type = parseHarvestType(v);
                      return type
                        ? HARVEST_TYPE_LABELS[type]
                        : "Selecione o tipo de colheita";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {HARVEST_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {HARVEST_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.harvestType && (
                <p className="text-sm text-destructive">{fieldErrors.harvestType}</p>
              )}
            </div>

            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor="crop-unit">Unidade</Label>
                <Select
                  value={values.unit}
                  onValueChange={(v) => handleUnitChange(v ?? "")}
                  disabled={submitting}
                >
                  <SelectTrigger
                    id="crop-unit"
                    className="w-full"
                    aria-invalid={Boolean(fieldErrors.unit)}
                  >
                    <SelectValue placeholder="Selecione a unidade">
                      {(v) => {
                        const unit = parseMeasurementUnit(v);
                        return unit ? UNIT_NAMES[unit] : "Selecione a unidade";
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {MEASUREMENT_UNITS.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {UNIT_NAMES[unit]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldErrors.unit && (
                  <p className="text-sm text-destructive">{fieldErrors.unit}</p>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor="crop-unit-weight">Peso da unidade (kg)</Label>
                <Input
                  id="crop-unit-weight"
                  type="text"
                  inputMode="decimal"
                  value={values.unitWeightKg}
                  onChange={(e) => update("unitWeightKg", e.target.value)}
                  onBlur={() => handleBlur("unitWeightKg")}
                  readOnly={unitWeightLocked}
                  disabled={submitting}
                  aria-invalid={Boolean(fieldErrors.unitWeightKg)}
                />
                {fieldErrors.unitWeightKg && (
                  <p className="text-sm text-destructive">
                    {fieldErrors.unitWeightKg}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="crop-is-priority"
                checked={values.isPriority}
                onCheckedChange={(checked) =>
                  update("isPriority", checked === true)
                }
                disabled={submitting}
              />
              <Label htmlFor="crop-is-priority" className="font-normal">
                Cultura prioritária
              </Label>
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
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
