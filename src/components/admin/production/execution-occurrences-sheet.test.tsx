import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

import { ExecutionOccurrencesSheet } from "@/components/admin/production/execution-occurrences-sheet";
import { ApiError } from "@/lib/api";
import {
  createOccurrence,
  deleteOccurrence,
  listOccurrences,
  updateOccurrence,
  type FieldOccurrence,
} from "@/lib/occurrences";
import type { ProductionExecution } from "@/lib/production";

vi.mock("@/lib/occurrences", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/occurrences")>("@/lib/occurrences");
  return {
    ...actual,
    listOccurrences: vi.fn(),
    createOccurrence: vi.fn(),
    updateOccurrence: vi.fn(),
    deleteOccurrence: vi.fn(),
  };
});

const EXECUTION: ProductionExecution = {
  id: "exec-1",
  productionPlanId: "plan-1",
  quantity: 12,
  quantityKg: 240,
  harvestedAt: "2026-05-10",
  status: "PENDING",
  notes: null,
  rejectionReason: null,
  validatedBy: null,
  validatedAt: null,
  createdAt: null,
  updatedAt: null,
};

const PEST: FieldOccurrence = {
  id: "o-1",
  executionId: "exec-1",
  logType: "PEST",
  description: "Lagarta do cartucho",
  weatherObservation: "Sol forte",
  evidenceUrl: "https://exemplo.test/foto.jpg",
  createdAt: "2026-10-02T09:00:00",
  updatedAt: null,
};

beforeEach(() => {
  vi.mocked(listOccurrences).mockResolvedValue([PEST]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderSheet(canWrite: boolean) {
  return render(
    <ExecutionOccurrencesSheet
      execution={EXECUTION}
      open
      onOpenChange={vi.fn()}
      canWrite={canWrite}
    />,
  );
}

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("ExecutionOccurrencesSheet — leitura (UNIT-006)", () => {
  it("lista tipo com texto, descrição, clima, data e link seguro da evidência", async () => {
    renderSheet(false);
    expect(await screen.findByText("Lagarta do cartucho")).toBeInTheDocument();
    expect(listOccurrences).toHaveBeenCalledWith("exec-1");
    expect(screen.getByText("Praga")).toBeInTheDocument();
    expect(screen.getByText("Clima: Sol forte")).toBeInTheDocument();
    expect(screen.getByText("Registrada em 02/10/2026")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Ver evidência/ });
    expect(link).toHaveAttribute("href", "https://exemplo.test/foto.jpg");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("evidência fora de http(s) não vira link", async () => {
    vi.mocked(listOccurrences).mockResolvedValue([
      { ...PEST, evidenceUrl: "javascript:alert(1)" },
    ]);
    renderSheet(false);
    await screen.findByText("Lagarta do cartucho");
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Evidência: javascript:alert(1)")).toBeInTheDocument();
  });

  it("mostra o estado vazio", async () => {
    vi.mocked(listOccurrences).mockResolvedValue([]);
    renderSheet(true);
    expect(
      await screen.findByText("Nenhuma ocorrência registrada neste apontamento"),
    ).toBeInTheDocument();
  });

  it("erro de carga fica no painel, com Tentar novamente", async () => {
    vi.mocked(listOccurrences)
      .mockRejectedValueOnce(new ApiError(403, "Sem acesso a este apontamento.", null))
      .mockResolvedValueOnce([PEST]);
    renderSheet(true);
    expect(await screen.findByText("Sem acesso a este apontamento.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("Lagarta do cartucho")).toBeInTheDocument();
  });
});

describe("ExecutionOccurrencesSheet — RBAC (UNIT-004)", () => {
  it("com escrita mostra Adicionar, Editar e Excluir", async () => {
    renderSheet(true);
    await screen.findByText("Lagarta do cartucho");
    expect(screen.getByRole("button", { name: "Adicionar ocorrência" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar ocorrência Praga" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Excluir ocorrência Praga" })).toBeInTheDocument();
  });

  it("somente leitura não mostra nenhuma ação de escrita", async () => {
    renderSheet(false);
    await screen.findByText("Lagarta do cartucho");
    expect(
      screen.queryByRole("button", { name: /Adicionar|Editar ocorrência|Excluir ocorrência/ }),
    ).toBeNull();
  });
});

describe("ExecutionOccurrencesSheet — formulário (UNIT-005)", () => {
  async function openCreate() {
    renderSheet(true);
    await screen.findByText("Lagarta do cartucho");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar ocorrência" }));
    await screen.findByText("Nova ocorrência");
  }

  it("valida tipo, descrição e URL http(s) sem chamar a API", async () => {
    await openCreate();
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("O tipo de ocorrência é obrigatório")).toBeInTheDocument();
    expect(screen.getByText("A descrição é obrigatória")).toBeInTheDocument();

    type("Tipo", "PEST");
    type("Descrição", "Lagarta");
    type("Link da evidência (opcional)", "javascript:alert(1)");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Informe um link http:// ou https:// válido")).toBeInTheDocument();
    expect(createOccurrence).not.toHaveBeenCalled();
  });

  it("cadastra com opcionais vazios como null e recarrega", async () => {
    vi.mocked(createOccurrence).mockResolvedValue(PEST);
    await openCreate();
    type("Tipo", "DISEASE");
    type("Descrição", " Ferrugem ");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(createOccurrence).toHaveBeenCalledWith("exec-1", {
        logType: "DISEASE",
        description: "Ferrugem",
        weatherObservation: null,
        evidenceUrl: null,
      }),
    );
    await waitFor(() => expect(listOccurrences).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("button", { name: "Adicionar ocorrência" })).toBeInTheDocument();
  });

  it("edita enviando PUT com os valores atuais de todos os campos", async () => {
    vi.mocked(updateOccurrence).mockResolvedValue(PEST);
    renderSheet(true);
    await screen.findByText("Lagarta do cartucho");
    fireEvent.click(screen.getByRole("button", { name: "Editar ocorrência Praga" }));
    await screen.findByText("Editar ocorrência");
    expect(screen.getByLabelText("Descrição")).toHaveValue("Lagarta do cartucho");
    type("Descrição", "Lagarta controlada");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(updateOccurrence).toHaveBeenCalledWith("o-1", {
        logType: "PEST",
        description: "Lagarta controlada",
        weatherObservation: "Sol forte",
        evidenceUrl: "https://exemplo.test/foto.jpg",
      }),
    );
  });

  it("edição que esvazia os opcionais envia texto vazio (o PUT do back ignora null)", async () => {
    vi.mocked(updateOccurrence).mockResolvedValue(PEST);
    renderSheet(true);
    await screen.findByText("Lagarta do cartucho");
    fireEvent.click(screen.getByRole("button", { name: "Editar ocorrência Praga" }));
    await screen.findByText("Editar ocorrência");
    type("Observação climática (opcional)", "");
    type("Link da evidência (opcional)", "");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(updateOccurrence).toHaveBeenCalledWith("o-1", {
        logType: "PEST",
        description: "Lagarta do cartucho",
        weatherObservation: "",
        evidenceUrl: "",
      }),
    );
  });

  it("mostra erros por campo do 400 e mantém o formulário", async () => {
    vi.mocked(createOccurrence).mockRejectedValue(
      new ApiError(400, "description: A descrição é obrigatória", {
        message: "description: A descrição é obrigatória",
      }),
    );
    await openCreate();
    type("Tipo", "PEST");
    type("Descrição", "x");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("A descrição é obrigatória")).toBeInTheDocument();
    expect(screen.getByText("Nova ocorrência")).toBeInTheDocument();
  });

  it("mostra a mensagem do 403 no formulário", async () => {
    vi.mocked(createOccurrence).mockRejectedValue(
      new ApiError(403, "O técnico não tem assistência nesta comunidade.", null),
    );
    await openCreate();
    type("Tipo", "PEST");
    type("Descrição", "x");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "O técnico não tem assistência nesta comunidade.",
    );
  });

  it("exclusão pede confirmação e recarrega a lista", async () => {
    vi.mocked(deleteOccurrence).mockResolvedValue(undefined);
    renderSheet(true);
    await screen.findByText("Lagarta do cartucho");
    fireEvent.click(screen.getByRole("button", { name: "Excluir ocorrência Praga" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(deleteOccurrence).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(deleteOccurrence).toHaveBeenCalledWith("o-1"));
    await waitFor(() => expect(listOccurrences).toHaveBeenCalledTimes(2));
  });
});
