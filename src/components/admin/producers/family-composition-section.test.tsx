import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  FamilyCompositionSection,
  KINSHIP_OPTIONS,
} from "@/components/admin/producers/family-composition-section";
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

function pick(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

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
    expect(await screen.findByText("Nenhum membro familiar cadastrado.")).toBeInTheDocument();
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
    pick("Parentesco", "Filho(a)");
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
    pick("Parentesco", "Filho(a)");
    type("Idade", "0");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(createFamilyMember).toHaveBeenCalledWith("f-1", {
        name: "Ana Souza",
        kinship: "Filho(a)",
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
    pick("Parentesco", "Outro");
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
    pick("Parentesco", "Filho(a)");
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

  describe("paginação", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ ...MARIA, id: `m-${i + 1}`, name: `Membro ${String(i + 1).padStart(2, "0")}` }));

    it("mostra 10 por página com o rodapé, navega e troca o tamanho", async () => {
      vi.mocked(listFamilyMembers).mockResolvedValue(many);
      render(<FamilyCompositionSection farmerId="f-1" canWrite={false} />);
      await screen.findByText("Membro 01");
      expect(screen.getByText("Membro 10")).toBeInTheDocument();
      expect(screen.queryByText("Membro 11")).toBeNull();
      expect(screen.getByRole("navigation", { name: "Paginação" })).toHaveTextContent(
        "Exibindo 1–10 de 12",
      );
      fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
      expect(screen.getByText("Membro 11")).toBeInTheDocument();
      expect(screen.getByText("Membro 12")).toBeInTheDocument();
      expect(screen.queryByText("Membro 01")).toBeNull();
      expect(screen.getByRole("navigation", { name: "Paginação" })).toHaveTextContent(
        "Exibindo 11–12 de 12",
      );
      const user = userEvent.setup();
      await user.click(screen.getByRole("combobox"));
      await user.click(await screen.findByRole("option", { name: "20" }));
      expect(await screen.findByText("Membro 01")).toBeInTheDocument();
      expect(screen.getByText("Membro 12")).toBeInTheDocument();
    });

    it("totais usam a lista inteira, não a página", async () => {
      vi.mocked(listFamilyMembers).mockResolvedValue(many);
      render(<FamilyCompositionSection farmerId="f-1" canWrite={false} />);
      await screen.findByText("Membro 01");
      expect(screen.getByText("(12 membros)")).toBeInTheDocument();
    });

    it("exclusão da última linha da segunda página volta à primeira, sem página vazia", async () => {
      const eleven = many.slice(0, 11);
      vi.mocked(listFamilyMembers).mockResolvedValueOnce(eleven).mockResolvedValue(eleven.slice(0, 10));
      vi.mocked(deleteFamilyMember).mockResolvedValue(undefined);
      render(<FamilyCompositionSection farmerId="f-1" canWrite />);
      await screen.findByText("Membro 01");
      fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
      fireEvent.click(screen.getByRole("button", { name: "Excluir Membro 11" }));
      const dialog = await screen.findByRole("alertdialog");
      fireEvent.click(within(dialog).getByRole("button", { name: "Excluir" }));
      await waitFor(() => expect(deleteFamilyMember).toHaveBeenCalledWith("m-11"));
      expect(await screen.findByText("Membro 01")).toBeInTheDocument();
      expect(screen.getByText("Membro 10")).toBeInTheDocument();
      // Com 10 itens (o menor tamanho de página) a paginação some (UX-L3-06).
      expect(screen.queryByRole("navigation", { name: "Paginação" })).toBeNull();
    });
  });
});

describe("FamilyCompositionSection — visual do redesign", () => {
  it("vazio com escrita: dica e CTA que abre o formulário, sem tabela", async () => {
    vi.mocked(listFamilyMembers).mockResolvedValue([]);
    render(<FamilyCompositionSection farmerId="f-1" canWrite />);
    expect(
      await screen.findByText(
        "Cadastre as pessoas da família do agricultor com nome, parentesco e idade.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
    // BP-L3-01: CTA de seção com o mesmo peso (outline) do botão do cabeçalho.
    const cta = screen.getByRole("button", { name: "Adicionar primeiro membro" });
    expect(cta.className).toContain("border-border");
    expect(cta.className).not.toContain("bg-primary");
    fireEvent.click(cta);
    expect(await screen.findByRole("dialog")).toHaveTextContent("Novo membro familiar");
  });

  it("vazio somente leitura: só a dica, sem botão", async () => {
    vi.mocked(listFamilyMembers).mockResolvedValue([]);
    render(<FamilyCompositionSection farmerId="f-1" canWrite={false} />);
    expect(
      await screen.findByText("Os membros da família aparecem aqui quando forem cadastrados."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("erro de campo fica ligado ao input por aria-describedby", async () => {
    render(<FamilyCompositionSection farmerId="f-1" canWrite />);
    await screen.findByText("Maria da Silva");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar membro" }));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    const error = await screen.findByText("O nome é obrigatório");
    expect(screen.getByLabelText("Nome").getAttribute("aria-describedby")).toBe(error.id);
  });
});

describe("FamilyCompositionSection — paginação e erro (UX-L3-05/06)", () => {
  it("com 10 ou menos membros não mostra a paginação", async () => {
    const ten = Array.from({ length: 10 }, (_, i) => ({
      ...MARIA,
      id: `m-${i + 1}`,
      name: `Membro ${String(i + 1).padStart(2, "0")}`,
    }));
    vi.mocked(listFamilyMembers).mockResolvedValue(ten);
    render(<FamilyCompositionSection farmerId="f-1" canWrite={false} />);
    await screen.findByText("Membro 10");
    expect(screen.queryByRole("navigation", { name: "Paginação" })).toBeNull();
  });

  it("erro sem mensagem de domínio (Erro 500) mostra o texto padrão, não o código", async () => {
    vi.mocked(listFamilyMembers).mockRejectedValue(new ApiError(500, "Erro 500", null));
    render(<FamilyCompositionSection farmerId="f-1" canWrite={false} />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Tente novamente em alguns instantes.");
    expect(alert.textContent).not.toContain("Erro 500");
  });
});


describe("FamilyCompositionSection — validação ao sair do campo", () => {
  async function openCreate() {
    render(<FamilyCompositionSection farmerId="f-1" canWrite />);
    await screen.findByText("Maria da Silva");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar membro" }));
    await screen.findByRole("dialog");
  }

  it("o blur numa idade inválida mostra o erro e liga aria-invalid/aria-describedby", async () => {
    await openCreate();
    type("Idade", "-1");
    expect(
      screen.queryByText("A idade deve ser um número inteiro, sem negativos"),
    ).not.toBeInTheDocument();
    fireEvent.blur(screen.getByLabelText("Idade"));
    const error = await screen.findByText("A idade deve ser um número inteiro, sem negativos");
    const input = screen.getByLabelText("Idade");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe(error.id);
  });

  it("o blur de nome e parentesco vazios mostra os erros", async () => {
    await openCreate();
    fireEvent.blur(screen.getByLabelText("Nome"));
    expect(await screen.findByText("O nome é obrigatório")).toBeInTheDocument();
    fireEvent.blur(screen.getByLabelText("Parentesco"));
    expect(await screen.findByText("O parentesco é obrigatório")).toBeInTheDocument();
  });

  it("digitar um valor válido tira o erro; um ainda inválido o mantém", async () => {
    await openCreate();
    type("Idade", "-1");
    fireEvent.blur(screen.getByLabelText("Idade"));
    await screen.findByText("A idade deve ser um número inteiro, sem negativos");
    type("Idade", "-2");
    expect(
      screen.getByText("A idade deve ser um número inteiro, sem negativos"),
    ).toBeInTheDocument();
    type("Idade", "12");
    expect(
      screen.queryByText("A idade deve ser um número inteiro, sem negativos"),
    ).not.toBeInTheDocument();
    const input = screen.getByLabelText("Idade");
    expect(input.getAttribute("aria-invalid")).toBe("false");
    expect(input.getAttribute("aria-describedby")).toBeNull();
  });

  it("o erro do back some ao digitar no campo", async () => {
    vi.mocked(createFamilyMember).mockRejectedValue(
      new ApiError(400, "kinship: O parentesco é obrigatório", {
        message: "kinship: O parentesco é obrigatório",
      }),
    );
    await openCreate();
    type("Nome", "Ana");
    pick("Parentesco", "Outro");
    type("Idade", "5");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("O parentesco é obrigatório")).toBeInTheDocument();
    pick("Parentesco", "Filho(a)");
    expect(screen.queryByText("O parentesco é obrigatório")).not.toBeInTheDocument();
  });
});

describe("FamilyCompositionSection — parentesco em select (RG5)", () => {
  async function openCreate() {
    render(<FamilyCompositionSection farmerId="f-1" canWrite />);
    await screen.findByText("Maria da Silva");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar membro" }));
    await screen.findByRole("dialog");
  }

  it("lista a opção vazia e as opções na ordem definida", async () => {
    await openCreate();
    const select = screen.getByLabelText("Parentesco");
    expect(select.tagName).toBe("SELECT");
    const options = within(select).getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["Selecione…", ...KINSHIP_OPTIONS]);
    expect(select).toHaveValue("");
  });

  it("o blur sem seleção mostra o erro e marca aria-invalid", async () => {
    await openCreate();
    const select = screen.getByLabelText("Parentesco");
    expect(select.getAttribute("aria-invalid")).toBe("false");
    fireEvent.blur(select);
    const error = await screen.findByText("O parentesco é obrigatório");
    expect(select.getAttribute("aria-invalid")).toBe("true");
    expect(select.getAttribute("aria-describedby")).toBe(error.id);
    await userEvent.selectOptions(select, "Cônjuge");
    expect(screen.queryByText("O parentesco é obrigatório")).not.toBeInTheDocument();
    expect(select.getAttribute("aria-invalid")).toBe("false");
  });

  it('escolher "Outro" envia "Outro"', async () => {
    vi.mocked(createFamilyMember).mockResolvedValue(MARIA);
    await openCreate();
    type("Nome", "Ana");
    await userEvent.selectOptions(screen.getByLabelText("Parentesco"), "Outro");
    type("Idade", "5");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(createFamilyMember).toHaveBeenCalledWith("f-1", {
        name: "Ana",
        kinship: "Outro",
        age: 5,
      }),
    );
  });

  it("na edição, parentesco fora da lista aparece selecionado e é enviado inalterado", async () => {
    const tio: FamilyMember = { ...MARIA, id: "m-3", name: "Zé Tio", kinship: "Tio" };
    vi.mocked(listFamilyMembers).mockResolvedValue([tio]);
    vi.mocked(updateFamilyMember).mockResolvedValue(tio);
    render(<FamilyCompositionSection farmerId="f-1" canWrite />);
    await screen.findByText("Zé Tio");
    fireEvent.click(screen.getByRole("button", { name: "Editar Zé Tio" }));
    await screen.findByRole("dialog");
    const select = screen.getByLabelText("Parentesco");
    expect(select).toHaveValue("Tio");
    expect(within(select).getByRole("option", { name: "Tio" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(updateFamilyMember).toHaveBeenCalledWith("m-3", {
        name: "Zé Tio",
        kinship: "Tio",
        age: 42,
      }),
    );
  });
});
