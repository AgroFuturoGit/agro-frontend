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

  it("ignora a resposta atrasada de outro apontamento", async () => {
    let resolveFirst: (v: FieldOccurrence[]) => void = () => {};
    vi.mocked(listOccurrences).mockImplementation((id: string) =>
      id === "exec-1"
        ? new Promise<FieldOccurrence[]>((r) => {
            resolveFirst = r;
          })
        : Promise.resolve([
            { ...PEST, id: "o-2", executionId: "exec-2", description: "Chuva de granizo" },
          ]),
    );
    const { rerender } = render(
      <ExecutionOccurrencesSheet
        execution={EXECUTION}
        open
        onOpenChange={vi.fn()}
        canWrite={false}
      />,
    );
    rerender(
      <ExecutionOccurrencesSheet
        execution={{ ...EXECUTION, id: "exec-2" }}
        open
        onOpenChange={vi.fn()}
        canWrite={false}
      />,
    );
    expect(await screen.findByText("Chuva de granizo")).toBeInTheDocument();
    resolveFirst([PEST]);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText("Lagarta do cartucho")).toBeNull();
    expect(screen.getByText("Chuva de granizo")).toBeInTheDocument();
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
    // A11Y-L6-5: o foco vai ao título do sheet, não ao body.
    expect(document.activeElement?.textContent).toBe("Ocorrências do apontamento");
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

  it("blur com a descrição vazia mostra o erro e digitar o tira", async () => {
    await openCreate();
    const description = screen.getByLabelText("Descrição");
    fireEvent.blur(description);
    expect(await screen.findByText("A descrição é obrigatória")).toBeInTheDocument();
    type("Descrição", "Lagarta");
    expect(screen.queryByText("A descrição é obrigatória")).not.toBeInTheDocument();
  });

  it("blur com link inválido mostra o erro e corrigir para https o tira", async () => {
    await openCreate();
    const link = screen.getByLabelText("Link da evidência (opcional)");
    type("Link da evidência (opcional)", "javascript:alert(1)");
    expect(screen.queryByText("Informe um link http:// ou https:// válido")).not.toBeInTheDocument();
    fireEvent.blur(link);
    expect(await screen.findByText("Informe um link http:// ou https:// válido")).toBeInTheDocument();
    type("Link da evidência (opcional)", "https://exemplo.test/a.jpg");
    expect(screen.queryByText("Informe um link http:// ou https:// válido")).not.toBeInTheDocument();
  });

  it("o erro do back no link some ao digitar nele", async () => {
    vi.mocked(createOccurrence).mockRejectedValue(
      new ApiError(400, "evidenceUrl: Link recusado", {
        message: "evidenceUrl: Link recusado",
      }),
    );
    await openCreate();
    type("Tipo", "PEST");
    type("Descrição", "Lagarta");
    type("Link da evidência (opcional)", "https://exemplo.test/a.jpg");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Link recusado")).toBeInTheDocument();
    type("Link da evidência (opcional)", "https://exemplo.test/b.jpg");
    expect(screen.queryByText("Link recusado")).not.toBeInTheDocument();
  });

  it("aria-invalid e aria-describedby acompanham o erro do blur", async () => {
    await openCreate();
    const description = screen.getByLabelText("Descrição");
    expect(description).not.toHaveAttribute("aria-invalid", "true");
    expect(description).not.toHaveAttribute("aria-describedby");
    fireEvent.blur(description);
    const error = await screen.findByText("A descrição é obrigatória");
    expect(description).toHaveAttribute("aria-invalid", "true");
    expect(description.getAttribute("aria-describedby")).toBe(error.id);
    type("Descrição", "Lagarta");
    expect(description).not.toHaveAttribute("aria-invalid", "true");
    expect(description).not.toHaveAttribute("aria-describedby");
  });

  it("blur no tipo vazio mostra o erro e escolher um tipo o tira", async () => {
    await openCreate();
    fireEvent.blur(screen.getByLabelText("Tipo"));
    expect(await screen.findByText("O tipo de ocorrência é obrigatório")).toBeInTheDocument();
    type("Tipo", "PEST");
    expect(screen.queryByText("O tipo de ocorrência é obrigatório")).not.toBeInTheDocument();
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

describe("ExecutionOccurrencesSheet — revisão r1 do lote 4", () => {
  it("A11Y-L4-2: erros de campo ficam em aria-describedby", async () => {
    renderSheet(true);
    await screen.findByText("Lagarta do cartucho");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar ocorrência" }));
    await screen.findByText("Nova ocorrência");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    const typeError = await screen.findByText("O tipo de ocorrência é obrigatório");
    expect(screen.getByLabelText("Tipo").getAttribute("aria-describedby")).toBe(typeError.id);
    const descError = screen.getByText("A descrição é obrigatória");
    expect(screen.getByLabelText("Descrição").getAttribute("aria-describedby")).toBe(descError.id);
  });

  it("A11Y-L4-5: abrir o formulário foca o Tipo; voltar devolve o foco ao botão", async () => {
    renderSheet(true);
    await screen.findByText("Lagarta do cartucho");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar ocorrência" }));
    await screen.findByText("Nova ocorrência");
    await waitFor(() => expect(document.activeElement?.id).toBe("occurrence-type"));
    fireEvent.click(screen.getByRole("button", { name: "Voltar à lista" }));
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Adicionar ocorrência" }),
      ),
    );
  });

  it("UX-L4-04: lista vazia não repete o CTA (só o botão do topo)", async () => {
    vi.mocked(listOccurrences).mockResolvedValue([]);
    renderSheet(true);
    await screen.findByText("Nenhuma ocorrência registrada neste apontamento");
    expect(screen.getAllByRole("button", { name: /Adicionar/ })).toHaveLength(1);
  });
});

describe("ExecutionOccurrencesSheet — erros e campos (lote 4)", () => {
  it("falha 500 na lista mostra o texto padrão e 'Tentar novamente'", async () => {
    vi.mocked(listOccurrences).mockRejectedValueOnce(new ApiError(500, "Erro 500", null));
    renderSheet(true);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Não foi possível carregar as ocorrências.");
    expect(alert.textContent).not.toContain("Erro 500");
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
  });

  it("A11Y-L4-2: clima e evidência ligam o erro por aria-describedby", async () => {
    renderSheet(true);
    await screen.findByText("Lagarta do cartucho");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar ocorrência" }));
    await screen.findByText("Nova ocorrência");
    type("Tipo", "PEST");
    type("Descrição", "Lagarta");
    type("Observação climática (opcional)", "x".repeat(300));
    type("Link da evidência (opcional)", "javascript:alert(1)");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    const urlError = await screen.findByText("Informe um link http:// ou https:// válido");
    expect(screen.getByLabelText("Link da evidência (opcional)").getAttribute("aria-describedby")).toBe(urlError.id);
    const weather = screen.getByLabelText("Observação climática (opcional)");
    expect(weather.getAttribute("aria-describedby")).toBe("occurrence-weather-error");
    expect(document.getElementById("occurrence-weather-error")).not.toBeNull();
  });

  it("A11Y-L4-3: erro do envio não fica dentro de região aria-live", async () => {
    vi.mocked(createOccurrence).mockRejectedValue(new ApiError(500, "Erro 500", null));
    renderSheet(true);
    await screen.findByText("Lagarta do cartucho");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar ocorrência" }));
    await screen.findByText("Nova ocorrência");
    type("Tipo", "PEST");
    type("Descrição", "Lagarta");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Não foi possível salvar a ocorrência.");
    expect(alert.parentElement?.closest("[aria-live]")).toBeNull();
  });

  it("tipo em Badge outline com data-type", async () => {
    renderSheet(true);
    const badge = (await screen.findByText("Praga")).closest("[data-slot=badge]");
    expect(badge?.getAttribute("data-type")).toBe("PEST");
    expect(badge?.getAttribute("data-variant")).toBe("outline");
  });
});
