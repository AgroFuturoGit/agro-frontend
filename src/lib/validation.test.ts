import { describe, expect, it } from "vitest";
import {
  DIGITS,
  LIMITS,
  digitsMessage,
  exceedsDigits,
  isEndBeforeStart,
  isFutureDate,
  isDecimalBr,
  isPositiveIntegerDigits,
  isValidEmail,
  isYearInRange,
  onlyDigits,
  parseDecimalBr,
  todayIso,
} from "@/lib/validation";

describe("validation", () => {
  it("onlyDigits remove a máscara", () => {
    expect(onlyDigits("529.982.247-25")).toBe("52998224725");
  });

  it("parseDecimalBr usa ponto como milhar e vírgula como decimal", () => {
    expect(parseDecimalBr("1.234")).toBe(1234);
    expect(parseDecimalBr("1.234,5")).toBe(1234.5);
    expect(parseDecimalBr("12,5")).toBe(12.5);
    expect(parseDecimalBr("1234")).toBe(1234);
    expect(parseDecimalBr("0,01")).toBe(0.01);
  });

  it("parseDecimalBr recusa entrada ambígua ou inválida", () => {
    for (const bad of ["12.5", "1e3", "1E3", "0x10", "abc", "-1", "+1", "1.", ".5", "", "1 2", "Infinity", "1,2,3"]) {
      expect(parseDecimalBr(bad)).toBeNaN();
      expect(isDecimalBr(bad)).toBe(false);
    }
    expect(isDecimalBr("10,5")).toBe(true);
  });

  it("isPositiveIntegerDigits aceita só inteiro positivo em dígitos", () => {
    expect(isPositiveIntegerDigits("120")).toBe(true);
    for (const bad of ["1e3", "0x10", "0", "-1", "1,5", "1.5", "", "abc"]) {
      expect(isPositiveIntegerDigits(bad)).toBe(false);
    }
  });

  it("isValidEmail exige domínio com ponto", () => {
    expect(isValidEmail("a@b.com")).toBe(true);
    expect(isValidEmail("x@x")).toBe(false);
    expect(isValidEmail("x@x.")).toBe(false);
    expect(isValidEmail("sem-arroba.com")).toBe(false);
  });

  it("datas: futuro, faixa de anos e fim antes do início", () => {
    const now = new Date(2026, 9, 25);
    expect(todayIso(now)).toBe("2026-10-25");
    expect(isFutureDate("2026-10-26", now)).toBe(true);
    expect(isFutureDate("2026-10-25", now)).toBe(false);
    expect(isYearInRange("2000-01-01")).toBe(true);
    expect(isYearInRange("2100-12-31")).toBe(true);
    expect(isYearInRange("1999-12-31")).toBe(false);
    expect(isYearInRange("2101-01-01")).toBe(false);
    expect(isEndBeforeStart("2026-05-01", "2026-04-30")).toBe(true);
    expect(isEndBeforeStart("2026-05-01", "2026-05-01")).toBe(false);
    expect(isEndBeforeStart("", "2026-05-01")).toBe(false);
  });
});

describe("limites do back", () => {
  it("exceedsDigits conta inteiros e decimais do @Digits", () => {
    expect(exceedsDigits("12345678", DIGITS.AMOUNT)).toBe(false);
    expect(exceedsDigits("123456789", DIGITS.AMOUNT)).toBe(true);
    expect(exceedsDigits("1,25", DIGITS.AMOUNT)).toBe(false);
    expect(exceedsDigits("1,255", DIGITS.AMOUNT)).toBe(true);
    expect(exceedsDigits("1,500", DIGITS.AMOUNT)).toBe(false);
    expect(exceedsDigits("0000001,5", DIGITS.AMOUNT)).toBe(false);
    expect(exceedsDigits("1.234.567,89", DIGITS.AMOUNT)).toBe(false);
    expect(exceedsDigits("123456,123", DIGITS.UNIT_WEIGHT)).toBe(false);
    expect(exceedsDigits("1234567", DIGITS.UNIT_WEIGHT)).toBe(true);
    expect(exceedsDigits("1,1234", DIGITS.UNIT_WEIGHT)).toBe(true);
    expect(exceedsDigits("12345678901", DIGITS.MONEY)).toBe(true);
    expect(exceedsDigits("abc", DIGITS.AMOUNT)).toBe(false);
  });

  it("digitsMessage descreve o limite", () => {
    expect(digitsMessage(8, 2)).toBe("Use no máximo 8 dígitos antes da vírgula e 2 depois.");
  });

  it("limites nomeados batem com o back", () => {
    expect(LIMITS.CROP_NAME).toBe(100);
    expect(LIMITS.HARVEST_LABEL).toBe(100);
    expect(LIMITS.MAX_CYCLE_DAYS).toBe(1000);
    expect(LIMITS.EXECUTION_NOTES).toBe(500);
  });
});
