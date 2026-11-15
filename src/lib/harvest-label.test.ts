import { describe, expect, it } from "vitest";

import { harvestText } from "./harvest-label";

describe("harvestText", () => {
  it("prefixa 'Safra' quando o rótulo não começa com ele", () => {
    expect(harvestText("2026")).toBe("Safra 2026");
  });

  it("não duplica o prefixo quando o rótulo já começa com 'Safra'", () => {
    expect(harvestText("Safra 2024/2025")).toBe("Safra 2024/2025");
    expect(harvestText("safra 2027")).toBe("safra 2027");
  });

  it("sem rótulo mostra 'Safra —'", () => {
    expect(harvestText(null)).toBe("Safra —");
    expect(harvestText(undefined)).toBe("Safra —");
    expect(harvestText("  ")).toBe("Safra —");
  });
});
