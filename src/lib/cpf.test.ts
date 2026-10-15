import { describe, expect, it } from "vitest";

import { formatCpf, isValidCpf } from "@/lib/cpf";

describe("isValidCpf", () => {
  it("aceita CPF válido com ou sem máscara", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224725")).toBe(true);
  });

  it("rejeita dígito verificador errado", () => {
    expect(isValidCpf("12345678901")).toBe(false);
    expect(isValidCpf("529.982.247-26")).toBe(false);
  });

  it("rejeita dígitos repetidos e tamanho errado", () => {
    expect(isValidCpf("11111111111")).toBe(false);
    expect(isValidCpf("123")).toBe(false);
    expect(isValidCpf("")).toBe(false);
  });
});

describe("formatCpf", () => {
  it("aplica a máscara progressivamente", () => {
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
    expect(formatCpf("5299")).toBe("529.9");
  });
});
