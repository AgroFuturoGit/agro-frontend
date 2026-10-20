import { describe, expect, it } from "vitest";

import { hasValidExpectedWindow } from "@/lib/harvest-timeline";

const base = {
  expectedHarvestStart: "2026-05-04",
  expectedHarvestEnd: "2026-06-29",
  expectedYield: 1800,
};

describe("hasValidExpectedWindow", () => {
  it("janela válida e meta > 0", () => {
    expect(hasValidExpectedWindow(base)).toBe(true);
    expect(
      hasValidExpectedWindow({ ...base, expectedHarvestEnd: "2026-05-04" }),
    ).toBe(true);
  });

  it("sem datas, fim antes do início ou data inválida", () => {
    expect(hasValidExpectedWindow({ ...base, expectedHarvestStart: null })).toBe(false);
    expect(hasValidExpectedWindow({ ...base, expectedHarvestEnd: null })).toBe(false);
    expect(
      hasValidExpectedWindow({ ...base, expectedHarvestEnd: "2026-05-03" }),
    ).toBe(false);
    expect(hasValidExpectedWindow({ ...base, expectedHarvestEnd: "xx" })).toBe(false);
  });

  it("meta zero ou negativa", () => {
    expect(hasValidExpectedWindow({ ...base, expectedYield: 0 })).toBe(false);
  });
});
