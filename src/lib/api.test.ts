import { describe, expect, it } from "vitest";

import { parseFieldErrors } from "@/lib/api";
import { parseOccurrenceFieldErrors } from "@/lib/occurrences";
import { parseSocialFieldErrors } from "@/lib/farmer-social";

describe("parseFieldErrors (UNIT-004)", () => {
  it("extrai erros por campo de 'campo: msg; campo: msg'", () => {
    expect(
      parseFieldErrors({ message: "name: Obrigatório; age: Deve ser positiva" }),
    ).toEqual({ name: "Obrigatório", age: "Deve ser positiva" });
  });

  it("ignora payload sem formato de campo", () => {
    expect(parseFieldErrors({ message: "Acesso negado" })).toEqual({});
    expect(parseFieldErrors(null)).toEqual({});
    expect(parseFieldErrors("x")).toEqual({});
    expect(parseFieldErrors({ message: 3 })).toEqual({});
  });

  it("é o mesmo parser usado pelas libs sociais e de ocorrências", () => {
    expect(parseSocialFieldErrors).toBe(parseFieldErrors);
    expect(parseOccurrenceFieldErrors).toBe(parseFieldErrors);
  });
});
