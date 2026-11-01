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

/** Valor mínimo de área e quantidade (mesmo `@DecimalMin` do back). */
export const MIN_POSITIVE_AMOUNT = 0.01;

const BR_DECIMAL_PATTERN = /^(\d+|\d{1,3}(?:\.\d{3})+)(?:,(\d+))?$/;

/**
 * Lê um número no padrão brasileiro (ponto é milhar, vírgula é decimal):
 * "1.234" -> 1234, "1.234,5" -> 1234.5, "12,5" -> 12.5, "1234" -> 1234.
 * Entrada ambígua ou inválida ("12.5", "1e3", "0x10", sinal, texto) -> NaN.
 */
export function parseDecimalBr(value: string): number {
  const match = BR_DECIMAL_PATTERN.exec(value.trim());
  if (!match) return Number.NaN;
  const int = match[1].replace(/\./g, "");
  return Number(match[2] ? `${int}.${match[2]}` : int);
}

/** Número para exibir/editar em campo de texto no padrão BR (12.5 -> "12,5"). */
export function formatDecimalInput(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(".", ",");
}

/** Verdadeiro quando `parseDecimalBr` aceita o texto. */
export function isDecimalBr(value: string): boolean {
  return !Number.isNaN(parseDecimalBr(value));
}

/** Inteiro positivo só em dígitos (recusa "1e3", "0x10", sinal). */
export function isPositiveIntegerDigits(value: string): boolean {
  const trimmed = value.trim();
  return /^\d+$/.test(trimmed) && Number(trimmed) > 0;
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
