/** Funções comuns de validação dos formulários. */

/** Limite de tamanho dos campos de texto (colunas VARCHAR(255) do back). */
export const TEXT_MAX_LENGTH = 255;

/** Faixa de sanidade para datas de safra (não é regra de negócio). */
export const MIN_YEAR = 2000;
export const MAX_YEAR = 2100;

export const NAME_MIN_LENGTH_MESSAGE = "O nome deve ter pelo menos 2 caracteres.";

/** Remove tudo que não é dígito (ex.: máscara do CPF). */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

const DECIMAL_PATTERN = /^\d+(?:[.,]\d+)?$/;

/**
 * Número decimal simples: só dígitos com separador (ponto ou vírgula).
 * Recusa notação científica (`1e3`), sinal, espaços e texto.
 */
export function isPlainDecimal(value: string): boolean {
  return DECIMAL_PATTERN.test(value.trim());
}

/** Converte um decimal simples em número; retorna NaN se não for válido. */
export function parsePlainDecimal(value: string): number {
  if (!isPlainDecimal(value)) return Number.NaN;
  return Number(value.trim().replace(",", "."));
}

/** E-mail com parte local, `@` e domínio com ponto (recusa `x@x`). */
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(value.trim());
}

/** `YYYY-MM-DD` de hoje no horário local. */
export function todayIso(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Data ISO (`YYYY-MM-DD`) posterior a hoje. */
export function isFutureDate(iso: string, now: Date = new Date()): boolean {
  return iso > todayIso(now);
}

/** Ano da data ISO dentro de 2000–2100. */
export function isYearInRange(iso: string): boolean {
  const year = Number(iso.slice(0, 4));
  return Number.isInteger(year) && year >= MIN_YEAR && year <= MAX_YEAR;
}

/** `end` não pode ser anterior a `start` (datas ISO; vazio é ignorado). */
export function isEndBeforeStart(start: string, end: string): boolean {
  return Boolean(start) && Boolean(end) && end < start;
}
