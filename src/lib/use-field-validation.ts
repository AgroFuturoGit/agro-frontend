import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

/** Origem de um erro: validação no cliente ou resposta 400/422 do back. */
export type FieldErrorOrigin = "client" | "server";

type StoredError = { message: string; origin: FieldErrorOrigin };

export type FieldValidation<F extends string, V> = {
  /** Erros por campo, prontos para a UI. */
  errors: Partial<Record<F, string>>;
  /**
   * Ao sair do campo: grava o erro local do campo ou o limpa. Um erro do back
   * no campo é mantido se o valor passa na validação local.
   */
  onBlur: (field: F, values: V) => void;
  /**
   * Ao digitar: revalida o próprio campo (se tinha erro) e os outros campos
   * com erro local, usando `nextValues`. Erro do back em outro campo fica;
   * campo sem erro não ganha erro.
   */
  onChange: (field: F, nextValues: V) => void;
  /** Substitui todos os erros (submit ou resposta do back). */
  setErrors: (map: Partial<Record<F, string>>, origin: FieldErrorOrigin) => void;
  /** Limpa todos os erros (abrir, fechar ou trocar o registro). */
  reset: () => void;
};

/**
 * Validação por campo ao sair do campo (blur), com revalidação ao digitar.
 * `validateField(field, values)` devolve o texto do erro ou `undefined`, e
 * deve derivar dos `values` recebidos tudo o que depende dos valores do
 * formulário. A função mais recente é sempre a usada, então o formulário
 * não precisa memorizá-la.
 */
export function useFieldValidation<F extends string, V>(
  validateField: (field: F, values: V) => string | undefined,
): FieldValidation<F, V> {
  const [stored, setStored] = useState<Partial<Record<F, StoredError>>>({});

  const validateRef = useRef(validateField);
  useLayoutEffect(() => {
    validateRef.current = validateField;
  });

  const onBlur = useCallback((field: F, values: V) => {
    const message = validateRef.current(field, values);
    setStored((prev) => {
      if (!message && !prev[field]) return prev;
      // Erro do back só some quando o usuário digita no campo (regra 1 do
      // onChange); o blur com valor válido localmente não o remove. Se o valor
      // for inválido localmente, o erro local o substitui.
      if (!message && prev[field]?.origin === "server") return prev;
      const next = { ...prev };
      if (message) next[field] = { message, origin: "client" };
      else delete next[field];
      return next;
    });
  }, []);

  const onChange = useCallback((field: F, nextValues: V) => {
    setStored((prev) => {
      const fields = Object.keys(prev) as F[];
      if (fields.length === 0) return prev;
      const next: Partial<Record<F, StoredError>> = {};
      for (const key of fields) {
        const current = prev[key];
        if (!current) continue;
        // Regra 3: erro do back em outro campo não é tocado.
        if (key !== field && current.origin === "server") {
          next[key] = current;
          continue;
        }
        // Regras 1 e 2: o próprio campo e os outros erros locais são
        // recalculados com os valores novos; o resultado passa a ser local.
        const message = validateRef.current(key, nextValues);
        if (message) next[key] = { message, origin: "client" };
      }
      return next;
    });
  }, []);

  const setErrors = useCallback(
    (map: Partial<Record<F, string>>, origin: FieldErrorOrigin) => {
      const next: Partial<Record<F, StoredError>> = {};
      for (const key of Object.keys(map) as F[]) {
        const message = map[key];
        if (message) next[key] = { message, origin };
      }
      setStored(next);
    },
    [],
  );

  const reset = useCallback(() => setStored({}), []);

  const errors = useMemo(() => {
    const out: Partial<Record<F, string>> = {};
    for (const key of Object.keys(stored) as F[]) {
      const entry = stored[key];
      if (entry) out[key] = entry.message;
    }
    return out;
  }, [stored]);

  return { errors, onBlur, onChange, setErrors, reset };
}
