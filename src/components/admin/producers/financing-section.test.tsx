import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

import { FinancingSection } from "@/components/admin/producers/financing-section";
import { useIsMobile } from "@/hooks/use-mobile";
import { ApiError } from "@/lib/api";
import {
  createFinancing,
  deleteFinancing,
  listFinancings,
  updateFinancing,
  type Financing,
} from "@/lib/farmer-social";

vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: vi.fn(() => false) }));
vi.mock("@/lib/farmer-social", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/farmer-social")>("@/lib/farmer-social");
  return {
    ...actual,
    listFinancings: vi.fn(),
    createFinancing: vi.fn(),
    updateFinancing: vi.fn(),
    deleteFinancing: vi.fn(),
  };
});

const PRONAF: Financing = {
  id: "fin-1",
  farmerId: "f-1",
  description: "PRONAF Custeio",
  status: "APPROVED",
  amount: 25000,
  createdAt: null,
  updatedAt: null,
};
const MAQ: Financing = {
  ...PRONAF,
  id: "fin-2",
  description: "Máquinas",
  status: "IN_ANALYSIS",
  amount: 1500.5,
};

beforeEach(() => {
  vi.mocked(useIsMobile).mockReturnValue(false);
  vi.mocked(listFinancings).mockResolvedValue([PRONAF, MAQ]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("FinancingSection — leitura (UNIT-003)", () => {
  it("lista descrição, situação com texto e valor em reais, com o total", async () => {
    render(<FinancingSection farmerId="f-1" canWrite={false} />);
    expect(await screen.findByText("PRONAF Custeio")).toBeInTheDocument();
    expect(listFinancings).toHaveBeenCalledWith("f-1");
    expect(screen.getByText("Aprovado")).toBeInTheDocument();
    expect(screen.getByText("Em análise")).toBeInTheDocument();
    expect(screen.getByText(/^R\$\s25\.000,00$/)).toBeInTheDocument();
    expect(screen.getByText(/^R\$\s1\.500,50$/)).toBeInTheDocument();
    expect(screen.getByTestId("financing-total")).toHaveTextContent(
      /Total financiado: R\$\s26\.500,50/,
    );
  });

  it("mostra o estado vazio, sem total", async () => {
    vi.mocked(listFinancings).mockResolvedValue([]);
    render(<FinancingSection farmerId="f-1" canWrite />);
    expect(await screen.findByText("Nenhum financiamento cadastrado")).toBeInTheDocument();
    expect(screen.queryByTestId("financing-total")).toBeNull();
  });

  it("erro na seção é local e o Tentar novamente recarrega", async () => {
    vi.mocked(listFinancings)
      .mockRejectedValueOnce(new ApiError(403, "Acesso negado ao agricultor.", null))
      .mockResolvedValueOnce([PRONAF]);
    render(<FinancingSection farmerId="f-1" canWrite />);
    expect(await screen.findByText("Acesso negado ao agricultor.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("PRONAF Custeio")).toBeInTheDocument();
  });
});

describe("FinancingSection — RBAC (UNIT-004)", () => {
  it.each([false, true])("com escrita (mobile=%s) mostra as 3 ações", async (mobile) => {
    vi.mocked(useIsMobile).mockReturnValue(mobile);
    render(<FinancingSection farmerId="f-1" canWrite />);
    await screen.findByText("PRONAF Custeio");
    expect(screen.getByRole("button", { name: "Adicionar financiamento" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar PRONAF Custeio" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Excluir PRONAF Custeio" })).toBeInTheDocument();
  });

  it.each([false, true])("somente leitura (mobile=%s) sem ação de escrita", async (mobile) => {
    vi.mocked(useIsMobile).mockReturnValue(mobile);
    render(<FinancingSection farmerId="f-1" canWrite={false} />);
    await screen.findByText("PRONAF Custeio");
    expect(screen.queryByRole("button", { name: /Adicionar|Editar|Excluir/ })).toBeNull();
  });
});

describe("FinancingSection — formulário (UNIT-005)", () => {
  async function openCreate() {
    render(<FinancingSection farmerId="f-1" canWrite />);
    await screen.findByText("PRONAF Custeio");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar financiamento" }));
    await screen.findByRole("dialog");
  }

  it("valida obrigatórios e valor ≥ 0,01 sem chamar a API", async () => {
    await openCreate();
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("A descrição é obrigatória")).toBeInTheDocument();
    expect(screen.getByText("A situação é obrigatória")).toBeInTheDocument();
    expect(screen.getByText("O valor é obrigatório")).toBeInTheDocument();

    type("Descrição", "PRONAF");
    type("Situação", "PENDING");
    type("Valor (R$)", "0");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("O valor deve ser maior que zero")).toBeInTheDocument();
    type("Valor (R$)", "abc");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("O valor deve ser maior que zero")).toBeInTheDocument();
    expect(createFinancing).not.toHaveBeenCalled();
  });

  it("aceita vírgula decimal, cadastra e recarrega", async () => {
    vi.mocked(createFinancing).mockResolvedValue(PRONAF);
    await openCreate();
    type("Descrição", " PRONAF Investimento ");
    type("Situação", "PENDING");
    type("Valor (R$)", "1.234,56");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(createFinancing).toHaveBeenCalledWith("f-1", {
        description: "PRONAF Investimento",
        status: "PENDING",
        amount: 1234.56,
      }),
    );
    await waitFor(() => expect(listFinancings).toHaveBeenCalledTimes(2));
  });

  it("edita enviando PUT com os valores atuais de todos os campos", async () => {
    vi.mocked(updateFinancing).mockResolvedValue(MAQ);
    render(<FinancingSection farmerId="f-1" canWrite />);
    await screen.findByText("Máquinas");
    fireEvent.click(screen.getByRole("button", { name: "Editar Máquinas" }));
    await screen.findByRole("dialog");
    expect(screen.getByLabelText("Valor (R$)")).toHaveValue("1500,5");
    type("Situação", "PAID");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(updateFinancing).toHaveBeenCalledWith("fin-2", {
        description: "Máquinas",
        status: "PAID",
        amount: 1500.5,
      }),
    );
  });

  it("mostra erros por campo do 400", async () => {
    vi.mocked(createFinancing).mockRejectedValue(
      new ApiError(400, "amount: O valor deve ser maior que zero", {
        message: "amount: O valor deve ser maior que zero",
      }),
    );
    await openCreate();
    type("Descrição", "X");
    type("Situação", "PENDING");
    type("Valor (R$)", "5");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("O valor deve ser maior que zero")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("mostra a mensagem do 403 no formulário", async () => {
    vi.mocked(createFinancing).mockRejectedValue(
      new ApiError(403, "O técnico não tem assistência nesta comunidade.", null),
    );
    await openCreate();
    type("Descrição", "X");
    type("Situação", "PENDING");
    type("Valor (R$)", "5");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "O técnico não tem assistência nesta comunidade.",
    );
  });

  it("exclusão pede confirmação nomeando o financiamento e recarrega", async () => {
    vi.mocked(deleteFinancing).mockResolvedValue(undefined);
    render(<FinancingSection farmerId="f-1" canWrite />);
    await screen.findByText("Máquinas");
    fireEvent.click(screen.getByRole("button", { name: "Excluir Máquinas" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Máquinas")).toBeInTheDocument();
    expect(deleteFinancing).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(deleteFinancing).toHaveBeenCalledWith("fin-2"));
    await waitFor(() => expect(listFinancings).toHaveBeenCalledTimes(2));
  });
});
