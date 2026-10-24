import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

import { FamilyCompositionSection } from "@/components/admin/producers/family-composition-section";
import { useIsMobile } from "@/hooks/use-mobile";
import { ApiError } from "@/lib/api";
import {
  createFamilyMember,
  deleteFamilyMember,
  listFamilyMembers,
  updateFamilyMember,
  type FamilyMember,
} from "@/lib/farmer-social";

vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: vi.fn(() => false) }));
vi.mock("@/lib/farmer-social", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/farmer-social")>("@/lib/farmer-social");
  return {
    ...actual,
    listFamilyMembers: vi.fn(),
    createFamilyMember: vi.fn(),
    updateFamilyMember: vi.fn(),
    deleteFamilyMember: vi.fn(),
  };
});

const MARIA: FamilyMember = {
  id: "m-1",
  farmerId: "f-1",
  name: "Maria da Silva",
  kinship: "Esposa",
  age: 42,
  createdAt: null,
  updatedAt: null,
};
const JOAO: FamilyMember = { ...MARIA, id: "m-2", name: "João Júnior", kinship: "Filho", age: 1 };

beforeEach(() => {
  vi.mocked(useIsMobile).mockReturnValue(false);
  vi.mocked(listFamilyMembers).mockResolvedValue([MARIA, JOAO]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("FamilyCompositionSection — leitura (UNIT-002)", () => {
  it("lista nome, parentesco e idade, com a contagem no título", async () => {
    render(<FamilyCompositionSection farmerId="f-1" canWrite={false} />);
    expect(await screen.findByText("Maria da Silva")).toBeInTheDocument();
    expect(listFamilyMembers).toHaveBeenCalledWith("f-1");
    expect(screen.getByText("Esposa")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("(2 membros)")).toBeInTheDocument();
  });

  it("mostra o estado vazio", async () => {
    vi.mocked(listFamilyMembers).mockResolvedValue([]);
    render(<FamilyCompositionSection farmerId="f-1" canWrite />);
    expect(await screen.findByText("Nenhum membro familiar cadastrado")).toBeInTheDocument();
    expect(screen.getByText("(0 membros)")).toBeInTheDocument();
  });

  it("erro na seção é local e o Tentar novamente recarrega", async () => {
    vi.mocked(listFamilyMembers)
      .mockRejectedValueOnce(new ApiError(403, "Acesso negado ao agricultor.", null))
      .mockResolvedValueOnce([MARIA]);
    render(<FamilyCompositionSection farmerId="f-1" canWrite />);
    expect(await screen.findByText("Acesso negado ao agricultor.")).toBeInTheDocument();
    expect(screen.queryByText(/membros\)/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("Maria da Silva")).toBeInTheDocument();
  });
});

describe("FamilyCompositionSection — RBAC (UNIT-004)", () => {
  it.each([[true, "desktop", false], [true, "mobile", true]])(
    "com escrita (%s, %s) mostra Adicionar, Editar e Excluir",
    async (_w, _label, mobile) => {
      vi.mocked(useIsMobile).mockReturnValue(mobile);
      render(<FamilyCompositionSection farmerId="f-1" canWrite />);
      await screen.findByText("Maria da Silva");
      expect(screen.getByRole("button", { name: "Adicionar membro" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Editar Maria da Silva" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Excluir Maria da Silva" })).toBeInTheDocument();
    },
  );

  it.each([false, true])(
    "somente leitura (mobile=%s) não mostra nenhuma ação de escrita",
    async (mobile) => {
      vi.mocked(useIsMobile).mockReturnValue(mobile);
      render(<FamilyCompositionSection farmerId="f-1" canWrite={false} />);
      await screen.findByText("Maria da Silva");
      expect(screen.queryByRole("button", { name: /Adicionar|Editar|Excluir/ })).toBeNull();
      expect(screen.queryByText("Ações")).toBeNull();
    },
  );
});

describe("FamilyCompositionSection — formulário (UNIT-005)", () => {
  async function openCreate() {
    render(<FamilyCompositionSection farmerId="f-1" canWrite />);
    await screen.findByText("Maria da Silva");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar membro" }));
    await screen.findByRole("dialog");
  }

  it("valida obrigatórios e idade inteira ≥ 0 sem chamar a API", async () => {
    await openCreate();
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("O nome é obrigatório")).toBeInTheDocument();
    expect(screen.getByText("O parentesco é obrigatório")).toBeInTheDocument();
    expect(screen.getByText("A idade é obrigatória")).toBeInTheDocument();

    type("Nome", "Ana");
    type("Parentesco", "Filha");
    type("Idade", "-1");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText(/número inteiro/)).toBeInTheDocument();
    type("Idade", "3.5");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText(/número inteiro/)).toBeInTheDocument();
    expect(createFamilyMember).not.toHaveBeenCalled();
  });

  it("cadastra com o payload do contrato e recarrega a lista", async () => {
    vi.mocked(createFamilyMember).mockResolvedValue(MARIA);
    await openCreate();
    type("Nome", "  Ana Souza ");
    type("Parentesco", "Filha");
    type("Idade", "0");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(createFamilyMember).toHaveBeenCalledWith("f-1", {
        name: "Ana Souza",
        kinship: "Filha",
        age: 0,
      }),
    );
    await waitFor(() => expect(listFamilyMembers).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("edita enviando PUT com os valores atuais de todos os campos", async () => {
    vi.mocked(updateFamilyMember).mockResolvedValue(MARIA);
    render(<FamilyCompositionSection farmerId="f-1" canWrite />);
    await screen.findByText("Maria da Silva");
    fireEvent.click(screen.getByRole("button", { name: "Editar Maria da Silva" }));
    await screen.findByRole("dialog");
    expect(screen.getByLabelText("Nome")).toHaveValue("Maria da Silva");
    type("Idade", "43");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(updateFamilyMember).toHaveBeenCalledWith("m-1", {
        name: "Maria da Silva",
        kinship: "Esposa",
        age: 43,
      }),
    );
  });

  it("mostra os erros por campo do 400 e mantém o diálogo aberto", async () => {
    vi.mocked(createFamilyMember).mockRejectedValue(
      new ApiError(400, "kinship: O parentesco é obrigatório", {
        message: "kinship: O parentesco é obrigatório",
      }),
    );
    await openCreate();
    type("Nome", "Ana");
    type("Parentesco", "x");
    type("Idade", "5");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("O parentesco é obrigatório")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("mostra a mensagem do 403 no formulário", async () => {
    vi.mocked(createFamilyMember).mockRejectedValue(
      new ApiError(403, "O técnico não tem assistência nesta comunidade.", null),
    );
    await openCreate();
    type("Nome", "Ana");
    type("Parentesco", "Filha");
    type("Idade", "5");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("O técnico não tem assistência nesta comunidade.");
  });

  it("exclusão pede confirmação nomeando o membro e recarrega", async () => {
    vi.mocked(deleteFamilyMember).mockResolvedValue(undefined);
    render(<FamilyCompositionSection farmerId="f-1" canWrite />);
    await screen.findByText("Maria da Silva");
    fireEvent.click(screen.getByRole("button", { name: "Excluir Maria da Silva" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Maria da Silva")).toBeInTheDocument();
    expect(deleteFamilyMember).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(deleteFamilyMember).toHaveBeenCalledWith("m-1"));
    await waitFor(() => expect(listFamilyMembers).toHaveBeenCalledTimes(2));
  });

  it("erro na exclusão aparece no diálogo", async () => {
    vi.mocked(deleteFamilyMember).mockRejectedValue(new ApiError(403, "Sem acesso.", null));
    render(<FamilyCompositionSection farmerId="f-1" canWrite />);
    await screen.findByText("Maria da Silva");
    fireEvent.click(screen.getByRole("button", { name: "Excluir Maria da Silva" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Excluir" }));
    expect(await within(dialog).findByText("Sem acesso.")).toBeInTheDocument();
  });
});
