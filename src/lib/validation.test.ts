import { describe, expect, it } from "vitest";
import {
  isEndBeforeStart,
  isFutureDate,
  isPlainDecimal,
  isValidEmail,
  isYearInRange,
  onlyDigits,
  parsePlainDecimal,
  todayIso,
} from "@/lib/validation";

describe("validation", () => {
  it("onlyDigits remove a máscara", () => {
    expect(onlyDigits("529.982.247-25")).toBe("52998224725");
  });

  it("isPlainDecimal recusa notação científica e texto", () => {
    for (const ok of ["1", "10.5", "10,5", "0.01"]) expect(isPlainDecimal(ok)).toBe(true);
    for (const bad of ["1e3", "1E3", "abc", "-1", "+1", "1.", ".5", "", "1 2", "Infinity"]) {
      expect(isPlainDecimal(bad)).toBe(false);
    }
    expect(parsePlainDecimal("10,5")).toBe(10.5);
    expect(parsePlainDecimal("1e3")).toBeNaN();
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
