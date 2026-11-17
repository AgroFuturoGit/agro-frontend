import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useFieldValidation } from "./use-field-validation";

type Field = "start" | "end" | "name";
type Values = { start: number; end: number; name: string };

const values = (over: Partial<Values> = {}): Values => ({
  start: 1,
  end: 5,
  name: "Ana",
  ...over,
});

function validate(field: Field, v: Values): string | undefined {
  if (field === "name") {
    if (v.name.trim() === "") return "Informe o nome";
    if (v.name.length < 3) return "Nome muito curto";
    return undefined;
  }
  if (field === "start") return v.start < 0 ? "Início inválido" : undefined;
  // "end" depende de "start".
  return v.end < v.start ? "Fim antes do início" : undefined;
}

function setup() {
  return renderHook(() => useFieldValidation<Field, Values>(validate));
}

describe("useFieldValidation", () => {
  afterEach(cleanup);

  it("o blur com valor inválido grava o erro e com valor válido limpa", () => {
    const { result } = setup();

    act(() => result.current.onBlur("name", values({ name: "" })));
    expect(result.current.errors).toEqual({ name: "Informe o nome" });

    act(() => result.current.onBlur("name", values({ name: "Ana" })));
    expect(result.current.errors).toEqual({});
  });

  it("onChange num campo com erro e valor válido tira o erro", () => {
    const { result } = setup();

    act(() => result.current.onBlur("name", values({ name: "" })));
    act(() => result.current.onChange("name", values({ name: "Maria" })));
    expect(result.current.errors.name).toBeUndefined();
  });

  it("onChange num campo com erro e valor ainda inválido mantém o erro e atualiza o texto", () => {
    const { result } = setup();

    act(() => result.current.onBlur("name", values({ name: "" })));
    act(() => result.current.onChange("name", values({ name: "A" })));
    expect(result.current.errors.name).toBe("Nome muito curto");

    act(() => result.current.onChange("name", values({ name: "Al" })));
    expect(result.current.errors.name).toBe("Nome muito curto");
  });

  it("onChange num campo sem erro não cria erro", () => {
    const { result } = setup();

    act(() => result.current.onChange("name", values({ name: "" })));
    expect(result.current.errors).toEqual({});
  });

  it("regra cruzada: corrigir A tira o erro local de B, que depende de A", () => {
    const { result } = setup();

    act(() => result.current.onBlur("end", values({ start: 10, end: 5 })));
    expect(result.current.errors).toEqual({ end: "Fim antes do início" });

    act(() => result.current.onChange("start", values({ start: 2, end: 5 })));
    expect(result.current.errors).toEqual({});
  });

  it("erro do back em B não some com onChange em A, mas some com onChange em B válido", () => {
    const { result } = setup();

    act(() => result.current.setErrors({ name: "Nome já cadastrado" }, "server"));
    expect(result.current.errors).toEqual({ name: "Nome já cadastrado" });

    act(() => result.current.onChange("start", values({ start: 2 })));
    expect(result.current.errors).toEqual({ name: "Nome já cadastrado" });

    act(() => result.current.onChange("name", values({ name: "Outro nome" })));
    expect(result.current.errors).toEqual({});
  });

  it("blur com valor válido não remove o erro do back no campo", () => {
    const { result } = setup();

    act(() => result.current.setErrors({ name: "Nome já cadastrado" }, "server"));
    act(() => result.current.onBlur("name", values({ name: "Ana" })));
    expect(result.current.errors).toEqual({ name: "Nome já cadastrado" });

    // O erro do back continua sumindo quando o usuário digita no campo.
    act(() => result.current.onChange("name", values({ name: "Outro nome" })));
    expect(result.current.errors).toEqual({});
  });

  it("blur com valor inválido troca o erro do back pelo erro local", () => {
    const { result } = setup();

    act(() => result.current.setErrors({ name: "Nome já cadastrado" }, "server"));
    act(() => result.current.onBlur("name", values({ name: "" })));
    expect(result.current.errors).toEqual({ name: "Informe o nome" });

    // Agora é local: o blur com valor válido o remove.
    act(() => result.current.onBlur("name", values({ name: "Ana" })));
    expect(result.current.errors).toEqual({});
  });

  it("erro do back em B, ao digitar em B ainda inválido, passa a local e é revalidado por A", () => {
    const { result } = setup();

    act(() => result.current.setErrors({ end: "Fim já usado" }, "server"));
    act(() => result.current.onChange("end", values({ start: 10, end: 5 })));
    expect(result.current.errors).toEqual({ end: "Fim antes do início" });

    // Agora é local: corrigir A deve tirá-lo.
    act(() => result.current.onChange("start", values({ start: 2, end: 5 })));
    expect(result.current.errors).toEqual({});
  });

  it("erro do back que passou a local é removido pelo blur com valor válido", () => {
    const { result } = setup();

    act(() => result.current.setErrors({ name: "Nome já cadastrado" }, "server"));
    act(() => result.current.onChange("name", values({ name: "A" })));
    expect(result.current.errors).toEqual({ name: "Nome muito curto" });

    act(() => result.current.onBlur("name", values({ name: "Ana" })));
    expect(result.current.errors).toEqual({});
  });

  it("setErrors(client) substitui o mapa inteiro e as funções mantêm identidade", () => {
    const { result, rerender } = setup();
    const { onBlur, onChange, reset, setErrors } = result.current;

    act(() => result.current.setErrors({ name: "Nome já cadastrado" }, "server"));
    act(() => result.current.setErrors({ start: "Início inválido" }, "client"));
    expect(result.current.errors).toEqual({ start: "Início inválido" });

    rerender();
    expect(result.current.onBlur).toBe(onBlur);
    expect(result.current.onChange).toBe(onChange);
    expect(result.current.reset).toBe(reset);
    expect(result.current.setErrors).toBe(setErrors);
  });

  it("reset() limpa tudo", () => {
    const { result } = setup();

    act(() => result.current.setErrors({ name: "Informe o nome", end: "Fim antes do início" }, "client"));
    act(() => result.current.setErrors({ start: "Início já usado" }, "server"));
    act(() => result.current.onBlur("name", values({ name: "" })));
    expect(Object.keys(result.current.errors).length).toBeGreaterThan(0);

    act(() => result.current.reset());
    expect(result.current.errors).toEqual({});
  });
});
