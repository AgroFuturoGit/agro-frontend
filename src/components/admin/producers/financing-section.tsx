"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type Row,
} from "@tanstack/react-table";
import { Inbox, Loader2, Pencil, Plus, Trash2 } from "lucide-react";

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
import { EmptyValue } from "@/components/admin/empty-value";
import { EmptyState } from "@/components/admin/empty-state";
import { SectionHeader } from "@/components/admin/section-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable } from "@/components/data-table/data-table";
import {
  DataTablePagination,
  needsPagination,
} from "@/components/data-table/data-table-pagination";
import {
  DataTableRowActions,
  type DataTableRowAction,
} from "@/components/data-table/data-table-row-actions";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ApiError, userFacingErrorHint, apiDomainMessage, apiErrorMessage } from "@/lib/api";
import {
  FINANCING_STATUSES,
  FINANCING_STATUS_LABELS,
  createFinancing,
  deleteFinancing,
  formatCurrency,
  listFinancings,
  parseAmountInput,
  parseSocialFieldErrors,
  updateFinancing,
  type Financing,
  type FinancingStatus,
} from "@/lib/farmer-social";
import { FINANCING_STATUS_VARIANT } from "@/lib/status-variants";
import { useFieldValidation } from "@/lib/use-field-validation";
import { DIGITS, LIMITS, digitsMessage, exceedsDigits } from "@/lib/validation";

type Props = {
  farmerId: string;
  /** ADMIN, TECHNICIAN e FARMER escrevem; MANAGER e role desconhecida só leem. */
  canWrite: boolean;
};

type FormValues = { description: string; status: string; amount: string };

const EMPTY: FormValues = { description: "", status: "", amount: "" };
const MAX_DESCRIPTION = LIMITS.FINANCING_DESCRIPTION;

type Field = keyof FormValues;
type FieldErrors = Partial<Record<Field, string>>;

function validate(values: FormValues): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.description.trim()) errors.description = "A descrição é obrigatória";
  else if (values.description.trim().length > MAX_DESCRIPTION)
    errors.description = `A descrição deve ter no máximo ${MAX_DESCRIPTION} caracteres`;
  if (!values.status) errors.status = "A situação é obrigatória";
  if (!values.amount.trim()) errors.amount = "O valor é obrigatório";
  else {
    const amount = parseAmountInput(values.amount);
    if (amount === null || amount < 0.01)
      errors.amount = "O valor deve ser maior que zero";
    else if (exceedsDigits(values.amount.trim().replace(/^R\$\s*/, ""), DIGITS.MONEY))
      errors.amount = digitsMessage(DIGITS.MONEY.integer, DIGITS.MONEY.fraction);
  }
  return errors;
}

/** Situação do financiamento: Badge semântico por status (sem cor crua). */
function StatusBadge({ status }: { status: FinancingStatus | null }) {
  if (!status) return <EmptyValue />;
  return (
    <Badge data-status={status} variant={FINANCING_STATUS_VARIANT[status]}>
      {FINANCING_STATUS_LABELS[status]}
    </Badge>
  );
}

/** Valor para o campo de texto na edição: vírgula decimal, sem milhar. */
function amountToInput(amount: number): string {
  return String(amount).replace(".", ",");
}

export function FinancingSection({ farmerId, canWrite }: Props) {
  const [items, setItems] = useState<Financing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Financing | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Financing | null>(null);

  const [values, setValues] = useState<FormValues>(EMPTY);
  const {
    errors: fieldErrors,
    onBlur,
    onChange,
    setErrors,
    reset,
  } = useFieldValidation<Field, FormValues>(
    (field, current) => validate(current)[field],
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await listFinancings(farmerId));
    } catch (err) {
      setError(apiDomainMessage(err) ?? "");
    } finally {
      setLoading(false);
    }
  }, [farmerId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function openCreate() {
    setEditTarget(null);
    setValues(EMPTY);
    reset();
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(item: Financing) {
    setEditTarget(item);
    setValues({
      description: item.description,
      status: item.status ?? "",
      amount: amountToInput(item.amount),
    });
    reset();
    setFormError(null);
    setFormOpen(true);
  }

  function update(field: Field, value: string) {
    const next = { ...values, [field]: value };
    setValues(next);
    onChange(field, next);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const errors = validate(values);
    setErrors(errors, "client");
    if (Object.keys(errors).length > 0) return;

    const payload = {
      description: values.description.trim(),
      status: values.status as FinancingStatus,
      amount: parseAmountInput(values.amount) as number,
    };
    setSubmitting(true);
    try {
      if (editTarget) await updateFinancing(editTarget.id, payload);
      else await createFinancing(farmerId, payload);
      setFormOpen(false);
      await refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        const fromApi = err.status === 400 ? parseSocialFieldErrors(err.payload) : {};
        if (Object.keys(fromApi).length > 0) {
          setErrors(fromApi as FieldErrors, "server");
        } else {
          setFormError(apiErrorMessage(err, "Não foi possível salvar o financiamento."));
        }
      } else {
        setFormError("Não foi possível salvar o financiamento.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      await deleteFinancing(deleteTarget.id);
      setDeleteTarget(null);
      await refresh();
    } catch (err) {
      setDeleteError(
        apiErrorMessage(err, "Não foi possível excluir o financiamento."),
      );
    } finally {
      setDeleting(false);
    }
  }

  // Nomes acessíveis "Editar {descrição}" / "Excluir {descrição}" (iguais
  // na tabela e no card mobile; os e2e procuram exatamente esses rótulos).
  function rowActions(item: Financing): DataTableRowAction[] {
    return [
      {
        label: `Editar ${item.description}`,
        icon: Pencil,
        onClick: () => openEdit(item),
      },
      {
        label: `Excluir ${item.description}`,
        icon: Trash2,
        tone: "destructive",
        onClick: () => {
          setDeleteError(null);
          setDeleteTarget(item);
        },
      },
    ];
  }

  const columns: ColumnDef<Financing>[] = [
    {
      accessorKey: "description",
      header: "Descrição",
      meta: { cellVariant: "primary" },
    },
    {
      accessorKey: "status",
      header: "Situação",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "amount",
      header: "Valor",
      meta: { numeric: true, cellVariant: "primary" },
      cell: ({ row }) => formatCurrency(row.original.amount),
    },
    ...(canWrite
      ? [
          {
            id: "actions",
            header: "Ações",
            cell: ({ row }: { row: Row<Financing> }) => (
              <DataTableRowActions actions={rowActions(row.original)} />
            ),
          } satisfies ColumnDef<Financing>,
        ]
      : []),
  ];

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: items,
    columns,
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  function renderMobileCard(row: Row<Financing>) {
    const item = row.original;
    return (
      <Card key={item.id} className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium text-foreground">{item.description}</p>
            <p className="mt-1 text-sm tabular-nums text-muted-foreground">
              {formatCurrency(item.amount)}
            </p>
            <div className="mt-1">
              <StatusBadge status={item.status} />
            </div>
          </div>
          {canWrite && (
            <DataTableRowActions
              align="end"
              className="shrink-0"
              actions={rowActions(item)}
            />
          )}
        </div>
      </Card>
    );
  }

  // Rejeitados e cancelados não são dinheiro financiado.
  const total = items
    .filter((item) => item.status !== "REJECTED" && item.status !== "CANCELED")
    .reduce((sum, item) => sum + item.amount, 0);
  const showTotal = !loading && error === null && items.length > 0;

  return (
    <section aria-labelledby="financing-title" className="flex flex-col gap-section-sm">
      <SectionHeader
        id="financing-title"
        title={
          <>
            Financiamentos
            {showTotal && (
              <span
                data-testid="financing-total"
                className="ml-2 text-base font-normal text-muted-foreground tabular-nums"
              >
                Total financiado: {formatCurrency(total)}
              </span>
            )}
          </>
        }
        actions={
          canWrite ? (
            <Button type="button" variant="outline" onClick={openCreate}>
              <Plus aria-hidden="true" />
              Adicionar financiamento
            </Button>
          ) : undefined
        }
      />

      {/* Carregando, erro (InlineAlert + "Tentar novamente") vêm do DataTable.
          O vazio fica fora da tabela (sem cabeçalhos de coluna vazios). */}
      {!loading && error === null && items.length === 0 ? (
        <EmptyState
          variant="card"
          icon={Inbox}
          title="Nenhum financiamento cadastrado."
          hint={
            canWrite
              ? "Registre os financiamentos do agricultor com descrição, situação e valor."
              : "Os financiamentos aparecem aqui quando forem cadastrados."
          }
          action={
            canWrite
              ? {
                  label: "Adicionar primeiro financiamento",
                  onClick: openCreate,
                  variant: "outline",
                }
              : undefined
          }
        />
      ) : (
        <DataTable
          label="Lista de financiamentos"
          table={table}
          columns={columns}
          isLoading={loading}
          hasError={error !== null}
          onRetry={refresh}
          errorHint={userFacingErrorHint(error)}
          renderMobileCard={renderMobileCard}
        />
      )}
      {/* Paginação só acima do menor tamanho de página (10), como na lista
          do técnico: as seções raramente passam disso. */}
      {showTotal && needsPagination(items.length) ? <DataTablePagination table={table} /> : null}

      {canWrite && (
        <>
          <Dialog open={formOpen} onOpenChange={(open) => !submitting && setFormOpen(open)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editTarget ? "Editar financiamento" : "Novo financiamento"}
                </DialogTitle>
                <DialogDescription>
                  Informe a descrição, a situação e o valor financiado em reais.
                </DialogDescription>
              </DialogHeader>
              <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
                {/* role="alert" do InlineAlert já anuncia (sem aria-live em volta). */}
                {formError && <InlineAlert variant="destructive">{formError}</InlineAlert>}
                <div className="flex flex-col gap-2">
                  <Label htmlFor="financing-description">Descrição</Label>
                  <Input
                    id="financing-description"
                    maxLength={MAX_DESCRIPTION}
                    value={values.description}
                    onChange={(e) => update("description", e.target.value)}
                    onBlur={() => onBlur("description", values)}
                    disabled={submitting}
                    placeholder="Ex.: PRONAF Custeio 2026"
                    aria-invalid={Boolean(fieldErrors.description)}
                    aria-describedby={fieldErrors.description ? "financing-description-error" : undefined}
                  />
                  {fieldErrors.description && (
                    <p id="financing-description-error" className="text-sm text-destructive">
                      {fieldErrors.description}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="financing-status">Situação</Label>
                  {/* <select> nativo (NativeSelect): mantém fireEvent.change e
                      selectOption("Situação") dos testes. */}
                  <NativeSelect
                    id="financing-status"
                    className="w-full"
                    value={values.status}
                    onChange={(e) => update("status", e.target.value)}
                    onBlur={() => onBlur("status", values)}
                    disabled={submitting}
                    aria-invalid={Boolean(fieldErrors.status)}
                    aria-describedby={
                      fieldErrors.status ? "financing-status-error" : undefined
                    }
                  >
                    <NativeSelectOption value="">Selecione…</NativeSelectOption>
                    {FINANCING_STATUSES.map((status) => (
                      <NativeSelectOption key={status} value={status}>
                        {FINANCING_STATUS_LABELS[status]}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  {fieldErrors.status && (
                    <p id="financing-status-error" className="text-sm text-destructive">
                      {fieldErrors.status}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="financing-amount">Valor (R$)</Label>
                  <Input
                    id="financing-amount"
                    inputMode="decimal"
                    value={values.amount}
                    onChange={(e) => update("amount", e.target.value)}
                    onBlur={() => onBlur("amount", values)}
                    disabled={submitting}
                    placeholder="Ex.: 25.000,00"
                    aria-invalid={Boolean(fieldErrors.amount)}
                    aria-describedby={fieldErrors.amount ? "financing-amount-error" : undefined}
                  />
                  {fieldErrors.amount && (
                    <p id="financing-amount-error" className="text-sm text-destructive">
                      {fieldErrors.amount}
                    </p>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setFormOpen(false)}
                    disabled={submitting}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
                        Salvando…
                      </>
                    ) : (
                      "Salvar"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <AlertDialog
            open={deleteTarget !== null}
            onOpenChange={(open) => {
              if (!open && !deleting) setDeleteTarget(null);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir financiamento</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação removerá o financiamento{" "}
                  <span className="font-medium text-foreground">
                    {deleteTarget?.description}
                  </span>
                  . Não é possível desfazer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              {deleteError && <InlineAlert variant="destructive">{deleteError}</InlineAlert>}
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? (
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
        </>
      )}
    </section>
  );
}
