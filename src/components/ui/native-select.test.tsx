import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NativeSelect, NativeSelectOption } from "./native-select";
import { Textarea } from "./textarea";

describe("NativeSelect", () => {
  afterEach(cleanup);

  it("mantém o <select> nativo associado ao label e aceita fireEvent.change", () => {
    const onChange = vi.fn();
    render(
      <>
        <label htmlFor="tipo">Tipo</label>
        <NativeSelect id="tipo" defaultValue="CLIMATE" onChange={onChange} className="w-full">
          <NativeSelectOption value="CLIMATE">Clima</NativeSelectOption>
          <NativeSelectOption value="PEST">Praga</NativeSelectOption>
        </NativeSelect>
      </>,
    );

    const select = screen.getByLabelText("Tipo") as HTMLSelectElement;
    expect(select.tagName).toBe("SELECT");
    expect(select).toHaveClass("h-control", "bg-input-background");

    fireEvent.change(select, { target: { value: "PEST" } });
    expect(onChange).toHaveBeenCalled();
    expect(select.value).toBe("PEST");
    // className vai no wrapper, não no <select>.
    expect(select.parentElement).toHaveClass("w-full");
  });

  it("o chevron é decorativo", () => {
    const { container } = render(
      <NativeSelect aria-label="Situação">
        <NativeSelectOption value="A">A</NativeSelectOption>
      </NativeSelect>,
    );

    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("Textarea", () => {
  afterEach(cleanup);

  it("é um <textarea> associado ao label, com a superfície de input", () => {
    render(
      <>
        <label htmlFor="motivo">Motivo (opcional)</label>
        <Textarea id="motivo" aria-describedby="motivo-hint" />
      </>,
    );

    const field = screen.getByLabelText("Motivo (opcional)");
    expect(field.tagName).toBe("TEXTAREA");
    expect(field).toHaveAttribute("aria-describedby", "motivo-hint");
    expect(field).toHaveClass("bg-input-background");

    fireEvent.change(field, { target: { value: "Fora do prazo" } });
    expect(field).toHaveValue("Fora do prazo");
  });
});
