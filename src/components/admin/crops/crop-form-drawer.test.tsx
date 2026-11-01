import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CropFormDrawer } from "@/components/admin/crops/crop-form-drawer";
import { createCrop, updateCrop, type Crop } from "@/lib/crops";
import { ApiError } from "@/lib/api";

vi.mock("@/lib/crops", async () => {
  const actual = await vi.importActual<typeof import("@/lib/crops")>("@/lib/crops");
  return { ...actual, createCrop: vi.fn(), updateCrop: vi.fn() };
});

const createCropMock = vi.mocked(createCrop);
const updateCropMock = vi.mocked(updateCrop);

const BOX_CROP: Crop = {
  id: "c-1",
  name: "Tomate",
  variety: "Italiano",
  isPriority: true,
  cycleDays: 90,
  expectedProductivity: 1500,
  harvestType: "CONTINUOUS",
  unit: "BOX",
  unitWeightKg: 20,
  createdAt: "2026-09-01T08:00:00.111111",
  updatedAt: "2026-10-30T10:15:30.123456",
};

function renderForm(mode: "create" | "edit", crop?: Crop) {
  const onSaved = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <CropFormDrawer
      mode={mode}
      open
      onOpenChange={onOpenChange}
      onSaved={onSaved}
      crop={crop}
    />,
  );
  return { onSaved, onOpenChange };
}

async function pickOption(label: string, option: string) {
  const user = userEvent.setup();
  await user.click(screen.getByLabelText(label));
  await user.click(await screen.findByRole("option", { name: option }));
  // Espera o popup fechar antes da próxima interação.
  await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
}

function submit() {
  fireEvent.submit(document.querySelector("form") as HTMLFormElement);
}

beforeEach(() => {
  createCropMock.mockReset();
  updateCropMock.mockReset();
});

afterEach(() => cleanup());

describe("CropFormDrawer — validação (UNIT-007 / AC-007)", () => {
  it("bloqueia o envio sem produtividade, tipo de colheita e unidade", async () => {
    renderForm("create");
    fireEvent.change(await screen.findByLabelText("Nome da cultura"), {
      target: { value: "Soja" },
    });
    fireEvent.change(screen.getByLabelText("Variedade"), {
      target: { value: "Convencional" },
    });
    submit();

    expect(
      await screen.findByText("Informe uma produtividade maior que zero"),
    ).toBeTruthy();
    expect(screen.getByText("Selecione o tipo de colheita", { selector: "p" })).toBeTruthy();
    expect(screen.getByText("Selecione a unidade", { selector: "p" })).toBeTruthy();
    expect(createCropMock).not.toHaveBeenCalled();
  });

  it("peso da unidade é obrigatório só para SACK/BOX", async () => {
    renderForm("create");
    await screen.findByLabelText("Nome da cultura");
    fireEvent.change(screen.getByLabelText("Nome da cultura"), { target: { value: "Café" } });
    fireEvent.change(screen.getByLabelText("Variedade"), { target: { value: "Arábica" } });
    fireEvent.change(screen.getByLabelText("Produtividade esperada (kg/ha)"), {
      target: { value: "1800" },
    });
    await pickOption("Tipo de colheita", "Colheita única");
    await pickOption("Unidade", "Saca");
    submit();

    expect(
      await screen.findByText("Informe o peso da unidade (maior que zero)"),
    ).toBeTruthy();
    expect(createCropMock).not.toHaveBeenCalled();
  });

  it("KG e TON preenchem o peso sozinhos e o deixam somente leitura", async () => {
    renderForm("create");
    await screen.findByLabelText("Nome da cultura");
    const weight = screen.getByLabelText("Peso da unidade (kg)") as HTMLInputElement;

    await pickOption("Unidade", "Quilograma (kg)");
    expect(weight.value).toBe("1");
    expect(weight.readOnly).toBe(true);

    await pickOption("Unidade", "Tonelada (t)");
    expect(weight.value).toBe("1000");
    expect(weight.readOnly).toBe(true);

    await pickOption("Unidade", "Caixa");
    expect(weight.value).toBe("");
    expect(weight.readOnly).toBe(false);
  });

  it("ciclo é opcional, mas se informado deve ser inteiro > 0", async () => {
    renderForm("edit", BOX_CROP);
    const cycle = await screen.findByLabelText("Ciclo (dias) — opcional");
    fireEvent.change(cycle, { target: { value: "0" } });
    submit();
    expect(
      await screen.findByText("Informe um número inteiro de dias maior que zero"),
    ).toBeTruthy();
    expect(updateCropMock).not.toHaveBeenCalled();
  });
});

describe("CropFormDrawer — payload completo (UNIT-007 / AC-002)", () => {
  it("cria enviando os 8 campos", async () => {
    createCropMock.mockResolvedValue(BOX_CROP);
    const { onSaved } = renderForm("create");
    fireEvent.change(await screen.findByLabelText("Nome da cultura"), {
      target: { value: "Tomate" },
    });
    fireEvent.change(screen.getByLabelText("Variedade"), { target: { value: "Italiano" } });
    fireEvent.change(screen.getByLabelText("Produtividade esperada (kg/ha)"), {
      target: { value: "1500" },
    });
    await pickOption("Tipo de colheita", "Colheita contínua");
    await pickOption("Unidade", "Caixa");
    fireEvent.change(screen.getByLabelText("Peso da unidade (kg)"), {
      target: { value: "20" },
    });
    submit();

    await waitFor(() =>
      expect(createCropMock).toHaveBeenCalledWith({
        name: "Tomate",
        variety: "Italiano",
        isPriority: false,
        cycleDays: null,
        expectedProductivity: 1500,
        harvestType: "CONTINUOUS",
        unit: "BOX",
        unitWeightKg: 20,
      }),
    );
    expect(onSaved).toHaveBeenCalled();
  });

  it("editar só o nome mantém ciclo, produtividade, tipo, unidade e peso", async () => {
    updateCropMock.mockResolvedValue(BOX_CROP);
    renderForm("edit", BOX_CROP);
    fireEvent.change(await screen.findByLabelText("Nome da cultura"), {
      target: { value: "Tomate Cereja" },
    });
    submit();

    await waitFor(() =>
      expect(updateCropMock).toHaveBeenCalledWith(
        "c-1",
        {
          name: "Tomate Cereja",
          variety: "Italiano",
          isPriority: true,
          cycleDays: 90,
          expectedProductivity: 1500,
          harvestType: "CONTINUOUS",
          unit: "BOX",
          unitWeightKg: 20,
        },
        "2026-10-30T10:15:30.123456",
      ),
    );
  });

  it("unidade KG envia unitWeightKg = 1", async () => {
    createCropMock.mockResolvedValue(BOX_CROP);
    renderForm("create");
    fireEvent.change(await screen.findByLabelText("Nome da cultura"), { target: { value: "Feijão" } });
    fireEvent.change(screen.getByLabelText("Variedade"), { target: { value: "Carioca" } });
    fireEvent.change(screen.getByLabelText("Produtividade esperada (kg/ha)"), {
      target: { value: "900" },
    });
    await pickOption("Tipo de colheita", "Colheita única");
    await pickOption("Unidade", "Quilograma (kg)");
    submit();
    await waitFor(() =>
      expect(createCropMock).toHaveBeenCalledWith(
        expect.objectContaining({ unit: "KG", unitWeightKg: 1, cycleDays: null }),
      ),
    );
  });
});

describe("CropFormDrawer — QA (UNIT-002 / UNIT-004)", () => {
  it("limita nome e variedade a 100 caracteres (limite do back)", async () => {
    renderForm("create");
    expect((await screen.findByLabelText("Nome da cultura")).getAttribute("maxlength")).toBe("100");
    expect(screen.getByLabelText("Variedade").getAttribute("maxlength")).toBe("100");
  });

  it("nome de 1 caractere mostra a mensagem de 2 caracteres; vazio pede o nome", async () => {
    renderForm("create");
    const name = await screen.findByLabelText("Nome da cultura");
    fireEvent.change(name, { target: { value: "A" } });
    submit();
    expect(await screen.findByText("O nome deve ter pelo menos 2 caracteres.")).toBeTruthy();
    fireEvent.change(name, { target: { value: "" } });
    submit();
    expect(await screen.findByText("Informe o nome da cultura")).toBeTruthy();
  });

  it("recusa notação científica na produtividade", async () => {
    renderForm("create");
    fireEvent.change(await screen.findByLabelText("Nome da cultura"), { target: { value: "Soja" } });
    fireEvent.change(screen.getByLabelText("Variedade"), { target: { value: "Convencional" } });
    fireEvent.change(screen.getByLabelText("Produtividade esperada (kg/ha)"), {
      target: { value: "1e3" },
    });
    submit();
    expect(await screen.findByText("Informe uma produtividade maior que zero")).toBeTruthy();
    expect(createCropMock).not.toHaveBeenCalled();
  });

  it("recusa '1e3' e '0x10' no ciclo, e '12.5' na produtividade", async () => {
    renderForm("edit", BOX_CROP);
    const cycle = await screen.findByLabelText("Ciclo (dias) — opcional");
    for (const bad of ["1e3", "0x10"]) {
      fireEvent.change(cycle, { target: { value: bad } });
      submit();
      expect(
        await screen.findByText("Informe um número inteiro de dias maior que zero"),
      ).toBeTruthy();
    }
    fireEvent.change(cycle, { target: { value: "90" } });
    fireEvent.change(screen.getByLabelText("Produtividade esperada (kg/ha)"), {
      target: { value: "12.5" },
    });
    submit();
    expect(await screen.findByText("Informe uma produtividade maior que zero")).toBeTruthy();
    expect(updateCropMock).not.toHaveBeenCalled();
  });
});

describe("CropFormDrawer — concorrência (UNIT-001 / UNIT-002)", () => {
  it("edição envia a versão recebida (updatedAt) como terceiro argumento", async () => {
    updateCropMock.mockResolvedValue(BOX_CROP);
    renderForm("edit", BOX_CROP);
    fireEvent.change(await screen.findByLabelText("Nome da cultura"), { target: { value: "Tomate X" } });
    submit();
    await waitFor(() => expect(updateCropMock).toHaveBeenCalled());
    expect(updateCropMock.mock.calls[0][2]).toBe("2026-10-30T10:15:30.123456");
  });

  it("sem updatedAt usa createdAt", async () => {
    updateCropMock.mockResolvedValue(BOX_CROP);
    renderForm("edit", { ...BOX_CROP, updatedAt: undefined });
    fireEvent.change(await screen.findByLabelText("Nome da cultura"), { target: { value: "Tomate X" } });
    submit();
    await waitFor(() => expect(updateCropMock).toHaveBeenCalled());
    expect(updateCropMock.mock.calls[0][2]).toBe("2026-09-01T08:00:00.111111");
  });

  it("criação não manda versão", async () => {
    createCropMock.mockResolvedValue(BOX_CROP);
    renderForm("create");
    fireEvent.change(await screen.findByLabelText("Nome da cultura"), { target: { value: "Feijão" } });
    fireEvent.change(screen.getByLabelText("Variedade"), { target: { value: "Carioca" } });
    fireEvent.change(screen.getByLabelText("Produtividade esperada (kg/ha)"), { target: { value: "900" } });
    await pickOption("Tipo de colheita", "Colheita única");
    await pickOption("Unidade", "Quilograma (kg)");
    submit();
    await waitFor(() => expect(createCropMock).toHaveBeenCalled());
    expect(createCropMock.mock.calls[0]).toHaveLength(1);
  });

  it("409 com current mostra o aviso, recarrega a lista, mantém o drawer aberto e não reenvia", async () => {
    updateCropMock.mockRejectedValue(
      new ApiError(409, "A cultura foi alterada por outro usuário depois que esta edição começou.", {
        message: "A cultura foi alterada por outro usuário depois que esta edição começou.",
        current: { id: "c-1" },
      }),
    );
    const { onSaved, onOpenChange } = renderForm("edit", BOX_CROP);
    fireEvent.change(await screen.findByLabelText("Nome da cultura"), { target: { value: "Tomate X" } });
    submit();
    expect(
      await screen.findByText(/Esta cultura foi alterada por outra pessoa enquanto você editava\./),
    ).toBeTruthy();
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(updateCropMock).toHaveBeenCalledTimes(1);
  });

  it("409 sem current segue mostrando a mensagem do back", async () => {
    updateCropMock.mockRejectedValue(new ApiError(409, "Operação conflita com dados existentes", {}));
    const { onSaved } = renderForm("edit", BOX_CROP);
    fireEvent.change(await screen.findByLabelText("Nome da cultura"), { target: { value: "Tomate X" } });
    submit();
    expect(await screen.findByText("Operação conflita com dados existentes")).toBeTruthy();
    expect(onSaved).not.toHaveBeenCalled();
  });
});

describe("CropFormDrawer — limites do back (UNIT-005)", () => {
  async function fillValid() {
    fireEvent.change(await screen.findByLabelText("Nome da cultura"), { target: { value: "Soja" } });
    fireEvent.change(screen.getByLabelText("Variedade"), { target: { value: "Conv" } });
    await pickOption("Tipo de colheita", "Colheita única");
    await pickOption("Unidade", "Saca");
  }

  it("recusa produtividade com mais de 8 inteiros ou 2 decimais", async () => {
    renderForm("create");
    await fillValid();
    fireEvent.change(screen.getByLabelText("Peso da unidade (kg)"), { target: { value: "60" } });
    for (const bad of ["123456789", "1,234"]) {
      fireEvent.change(screen.getByLabelText("Produtividade esperada (kg/ha)"), { target: { value: bad } });
      submit();
      expect(
        await screen.findByText("Use no máximo 8 dígitos antes da vírgula e 2 depois."),
      ).toBeTruthy();
    }
    expect(createCropMock).not.toHaveBeenCalled();
  });

  it("recusa peso da unidade com mais de 6 inteiros ou 3 decimais", async () => {
    renderForm("create");
    await fillValid();
    fireEvent.change(screen.getByLabelText("Produtividade esperada (kg/ha)"), { target: { value: "900" } });
    fireEvent.change(screen.getByLabelText("Peso da unidade (kg)"), { target: { value: "1,2345" } });
    submit();
    expect(
      await screen.findByText("Use no máximo 6 dígitos antes da vírgula e 3 depois."),
    ).toBeTruthy();
    expect(createCropMock).not.toHaveBeenCalled();
  });

  it("recusa ciclo acima de 1000 dias e aceita 1000", async () => {
    renderForm("edit", BOX_CROP);
    const cycle = await screen.findByLabelText("Ciclo (dias) — opcional");
    fireEvent.change(cycle, { target: { value: "1001" } });
    submit();
    expect(await screen.findByText("O ciclo deve ter no máximo 1000 dias")).toBeTruthy();
    expect(updateCropMock).not.toHaveBeenCalled();
    updateCropMock.mockResolvedValue(BOX_CROP);
    fireEvent.change(cycle, { target: { value: "1000" } });
    submit();
    await waitFor(() => expect(updateCropMock).toHaveBeenCalled());
  });
});
