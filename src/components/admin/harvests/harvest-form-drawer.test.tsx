import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HarvestFormDrawer } from "@/components/admin/harvests/harvest-form-drawer";
import { ApiError } from "@/lib/api";
import { createHarvest, updateHarvest, type Harvest } from "@/lib/harvests";

vi.mock("@/lib/harvests", async () => {
  const actual = await vi.importActual<typeof import("@/lib/harvests")>("@/lib/harvests");
  return { ...actual, createHarvest: vi.fn(), updateHarvest: vi.fn() };
});

const createHarvestMock = vi.mocked(createHarvest);
const updateHarvestMock = vi.mocked(updateHarvest);

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

beforeEach(() => {
  createHarvestMock.mockReset();
  updateHarvestMock.mockReset();
});
afterEach(() => cleanup());

describe("HarvestFormDrawer — QA (UNIT-002 / UNIT-003)", () => {
  it("limita o rótulo a 100 caracteres (limite do back)", async () => {
    renderForm();
    expect((await screen.findByLabelText("Rótulo")).getAttribute("maxlength")).toBe("100");
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

const SAVED: Harvest = {
  id: "h-1",
  label: "Safra 2031",
  startDate: "2031-01-01",
  endDate: "2031-12-31",
  createdAt: "2026-09-01T08:00:00.111111",
  updatedAt: "2026-10-30T10:15:30.654321",
};

function renderEdit(harvest: Harvest = SAVED) {
  const onSaved = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <HarvestFormDrawer
      mode="edit"
      open
      onOpenChange={onOpenChange}
      onSaved={onSaved}
      harvest={harvest}
    />,
  );
  return { onSaved, onOpenChange };
}

describe("HarvestFormDrawer — concorrência (UNIT-001 / UNIT-002)", () => {
  it("edição envia a versão recebida (updatedAt) como terceiro argumento", async () => {
    updateHarvestMock.mockResolvedValue(SAVED);
    renderEdit();
    fill("Rótulo", "Safra 2031 B");
    submit();
    await waitFor(() => expect(updateHarvestMock).toHaveBeenCalled());
    expect(updateHarvestMock.mock.calls[0][2]).toBe("2026-10-30T10:15:30.654321");
  });

  it("sem updatedAt usa createdAt", async () => {
    updateHarvestMock.mockResolvedValue(SAVED);
    renderEdit({ ...SAVED, updatedAt: undefined });
    fill("Rótulo", "Safra 2031 B");
    submit();
    await waitFor(() => expect(updateHarvestMock).toHaveBeenCalled());
    expect(updateHarvestMock.mock.calls[0][2]).toBe("2026-09-01T08:00:00.111111");
  });

  it("criação não manda versão", async () => {
    createHarvestMock.mockResolvedValue(SAVED);
    renderForm();
    await screen.findByLabelText("Rótulo");
    fill("Rótulo", "Safra X");
    fill("Data de início", "2025-09-01");
    fill("Data de término", "2026-03-31");
    submit();
    await waitFor(() => expect(createHarvestMock).toHaveBeenCalled());
    expect(createHarvestMock.mock.calls[0]).toHaveLength(1);
  });

  it("409 com current mostra o aviso, recarrega a lista, mantém o drawer aberto e não reenvia", async () => {
    updateHarvestMock.mockRejectedValue(
      new ApiError(409, "A safra foi alterada por outro usuário depois que esta edição começou.", {
        current: { id: "h-1" },
      }),
    );
    const { onSaved, onOpenChange } = renderEdit();
    fill("Rótulo", "Safra 2031 B");
    submit();
    expect(
      await screen.findByText(/Esta safra foi alterada por outra pessoa enquanto você editava\./),
    ).toBeTruthy();
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(updateHarvestMock).toHaveBeenCalledTimes(1);
  });

  it("409 sem current segue mostrando a mensagem do back", async () => {
    updateHarvestMock.mockRejectedValue(new ApiError(409, "Outro conflito", {}));
    const { onSaved } = renderEdit();
    fill("Rótulo", "Safra 2031 B");
    submit();
    expect(await screen.findByText("Outro conflito")).toBeTruthy();
    expect(onSaved).not.toHaveBeenCalled();
  });
});
