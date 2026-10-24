import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HarvestFormDrawer } from "@/components/admin/harvests/harvest-form-drawer";
import { createHarvest } from "@/lib/harvests";

vi.mock("@/lib/harvests", async () => {
  const actual = await vi.importActual<typeof import("@/lib/harvests")>("@/lib/harvests");
  return { ...actual, createHarvest: vi.fn(), updateHarvest: vi.fn() };
});

const createHarvestMock = vi.mocked(createHarvest);

function renderForm() {
  const onSaved = vi.fn();
  render(
    <HarvestFormDrawer mode="create" open onOpenChange={vi.fn()} onSaved={onSaved} />,
  );
  return { onSaved };
}

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function submit() {
  fireEvent.submit(document.querySelector("form") as HTMLFormElement);
}

beforeEach(() => createHarvestMock.mockReset());
afterEach(() => cleanup());

describe("HarvestFormDrawer — QA (UNIT-002 / UNIT-003)", () => {
  it("limita o rótulo a 255 caracteres", async () => {
    renderForm();
    expect((await screen.findByLabelText("Rótulo")).getAttribute("maxlength")).toBe("255");
  });

  it("rótulo de 1 caractere mostra a mensagem de 2 caracteres; vazio pede o rótulo", async () => {
    renderForm();
    await screen.findByLabelText("Rótulo");
    fill("Rótulo", "A");
    submit();
    expect(await screen.findByText("O nome deve ter pelo menos 2 caracteres.")).toBeTruthy();
    fill("Rótulo", "");
    submit();
    expect(await screen.findByText("Informe o rótulo da safra")).toBeTruthy();
  });

  it("recusa datas fora de 2000–2100", async () => {
    renderForm();
    await screen.findByLabelText("Rótulo");
    fill("Rótulo", "Safra X");
    fill("Data de início", "1999-05-01");
    fill("Data de término", "2101-05-01");
    submit();
    expect(await screen.findAllByText("Informe uma data entre 2000 e 2100")).toHaveLength(2);
    expect(createHarvestMock).not.toHaveBeenCalled();
  });

  it("recusa fim antes do início", async () => {
    renderForm();
    await screen.findByLabelText("Rótulo");
    fill("Rótulo", "Safra X");
    fill("Data de início", "2025-05-01");
    fill("Data de término", "2025-04-01");
    submit();
    expect(
      await screen.findByText("A data de término deve ser igual ou posterior à de início"),
    ).toBeTruthy();
    expect(createHarvestMock).not.toHaveBeenCalled();
  });

  it("aceita safra válida", async () => {
    createHarvestMock.mockResolvedValue({
      id: "h", label: "Safra X", startDate: "2025-09-01", endDate: "2026-03-31",
    });
    const { onSaved } = renderForm();
    await screen.findByLabelText("Rótulo");
    fill("Rótulo", "Safra X");
    fill("Data de início", "2025-09-01");
    fill("Data de término", "2026-03-31");
    submit();
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });
});
