import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";

import { CommunityProducersPage } from "@/components/admin/communities/community-producers-page";
import { ApiError } from "@/lib/api";
import { readUserFromStorage, type AuthUser, type Role } from "@/lib/auth";
import { getCommunity, type Community } from "@/lib/communities";
import { useIsMobile } from "@/hooks/use-mobile";
import { getMyManager, type Manager } from "@/lib/managers";
import { listProducers, type Producer } from "@/lib/producers";
import type { Organization } from "@/lib/organizations";
import { resetNavigationMock, router } from "@/test/next-navigation";

vi.mock("next/navigation", async () => {
  const { navigationMockModule } = await import("@/test/next-navigation");
  return navigationMockModule;
});

vi.mock("@/lib/communities", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/communities")>(
      "@/lib/communities",
    );
  return { ...actual, getCommunity: vi.fn() };
});

vi.mock("@/lib/producers", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/producers")>("@/lib/producers");
  return { ...actual, listProducers: vi.fn() };
});

vi.mock("@/lib/managers", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/managers")>("@/lib/managers");
  return { ...actual, getMyManager: vi.fn() };
});

vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: vi.fn(() => false) }));

vi.mock("@/lib/auth", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return { ...actual, readUserFromStorage: vi.fn() };
});

const MY_ORGANIZATION: Organization = {
  id: "org-a",
  name: "Cooperativa Alfa",
  taxId: "11111111000191",
  type: "COOP",
};

const OTHER_ORGANIZATION: Organization = {
  id: "org-b",
  name: "Cooperativa Beta",
  taxId: "22222222000191",
  type: "COOP",
};

const COMMUNITY_ALFA: Community = {
  id: "community-alfa",
  name: "Comunidade Alfa",
  organization: MY_ORGANIZATION,
};

const COMMUNITY_DE_OUTRA_ORG: Community = {
  id: "community-externa",
  name: "Comunidade Externa",
  organization: OTHER_ORGANIZATION,
};

const MY_MANAGER: Manager = {
  id: "manager-1",
  user: {
    id: "user-manager",
    fullName: "Marta Gestora",
    email: "marta@agro.com",
    cpf: "98765432100",
    role: "MANAGER",
    dateOfBirth: null,
  },
  organization: MY_ORGANIZATION,
};

const PRODUCER_ALFA: Producer = {
  id: "producer-1",
  fullName: null,
  cpf: null,
  dateOfBirth: null,
  motherName: null,
  origin: null,
  educationLevel: null,
  phone: null,
  localName: null,
  street: null,
  city: null,
  state: null,
  ibgeCode: null,
  latitude: null,
  longitude: null,
  registrationSource: null,
  createdAt: null,
  updatedAt: null,
  isCompliant: true,
  user: {
    id: "user-1",
    fullName: "Ana Alves",
    email: "ana@agro.com",
    cpf: "12345678901",
  },
  community: { id: "community-alfa", name: "Comunidade Alfa", organization: MY_ORGANIZATION },
};

function loginAs(role: Role) {
  const user: AuthUser = {
    id: "user-logado",
    fullName: "Usuário Logado",
    email: "logado@agro.com",
    cpf: "98765432100",
    role,
    dateOfBirth: null,
  };
  vi.mocked(readUserFromStorage).mockReturnValue(user);
}

beforeEach(() => {
  vi.mocked(readUserFromStorage).mockReturnValue(null);
  vi.mocked(getCommunity).mockResolvedValue(COMMUNITY_ALFA);
  vi.mocked(listProducers).mockResolvedValue([PRODUCER_ALFA]);
  vi.mocked(getMyManager).mockResolvedValue(MY_MANAGER);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  resetNavigationMock();
});

describe("CommunityProducersPage — escopo por comunidade", () => {
  it("ADMIN: lista os agricultores da comunidade sem filtro adicional", async () => {
    loginAs("ADMIN");

    render(<CommunityProducersPage communityId="community-alfa" />);

    expect(await screen.findByText("Ana Alves")).toBeTruthy();
    expect(listProducers).toHaveBeenCalledExactlyOnceWith("community-alfa");
    expect(screen.getByRole("button", { name: "Novo agricultor" })).toBeTruthy();
    // Ações com o nome do registro (prefixo mantido).
    expect(screen.getByRole("button", { name: "Editar agricultor Ana Alves" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Excluir agricultor Ana Alves" })).toBeTruthy();
  });

  it("UNIT-002: usa o nome do agricultor (BR-001), cai para o do usuário e mostra o nome local", async () => {
    loginAs("ADMIN");
    vi.mocked(listProducers).mockResolvedValue([
      { ...PRODUCER_ALFA, fullName: "Ana do Sítio", localName: "Sítio Boa Vista" },
      {
        ...PRODUCER_ALFA,
        id: "producer-2",
        fullName: null,
        user: { ...PRODUCER_ALFA.user!, id: "user-2", fullName: "Bruno Usuário" },
      },
    ]);

    render(<CommunityProducersPage communityId="community-alfa" />);

    expect(await screen.findByText("Ana do Sítio")).toBeTruthy();
    expect(screen.getByText("Bruno Usuário")).toBeTruthy();
    expect(screen.queryByText("Ana Alves")).toBeNull();
    expect(screen.getByText("Sítio Boa Vista")).toBeTruthy();
    expect(
      screen.getByRole("columnheader", { name: /Endereço\/Nome local/ }),
    ).toBeTruthy();
  });

  it("MANAGER: comunidade da própria organização é exibida normalmente", async () => {
    loginAs("MANAGER");

    render(<CommunityProducersPage communityId="community-alfa" />);

    expect(await screen.findByText("Ana Alves")).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("MANAGER: comunidade de outra organização é bloqueada e redireciona (guarda de ownership)", async () => {
    loginAs("MANAGER");
    vi.mocked(getCommunity).mockResolvedValue(COMMUNITY_DE_OUTRA_ORG);

    render(<CommunityProducersPage communityId="community-externa" />);

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith(`/admin/organizacoes/${MY_ORGANIZATION.id}`),
    );
    // Nenhum dado da comunidade de outra organização chega a aparecer.
    expect(screen.queryByText("Ana Alves")).toBeNull();
  });

  it("TECHNICIAN: não vê botão de cadastro (sem afordância de escrita)", async () => {
    loginAs("TECHNICIAN");

    render(<CommunityProducersPage communityId="community-alfa" />);

    expect(await screen.findByText("Ana Alves")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Novo agricultor" }),
    ).toBeNull();
  });

  it("listagem vazia mostra o estado vazio, sem alerta", async () => {
    loginAs("ADMIN");
    vi.mocked(listProducers).mockResolvedValue([]);

    render(<CommunityProducersPage communityId="community-alfa" />);

    expect(
      await screen.findByText("Nenhum agricultor cadastrado nesta comunidade ainda."),
    ).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("erro de listProducers exibe role=alert com a mensagem do ApiError", async () => {
    loginAs("ADMIN");
    vi.mocked(listProducers).mockRejectedValue(
      new ApiError(500, "Erro interno do servidor", {}),
    );

    render(<CommunityProducersPage communityId="community-alfa" />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Erro interno do servidor");
  });

  it("falha de getMyManager (MANAGER) bloqueia com alerta, sem exibir agricultores", async () => {
    loginAs("MANAGER");
    vi.mocked(getMyManager).mockRejectedValue(new ApiError(500, "Falhou", {}));

    render(<CommunityProducersPage communityId="community-alfa" />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Falhou");
    expect(screen.queryByText("Ana Alves")).toBeNull();
  });
});

describe("CommunityProducersPage — tabela de dados", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("filtra por e-mail após o debounce", async () => {
    loginAs("ADMIN");
    vi.mocked(listProducers).mockResolvedValue([
      PRODUCER_ALFA,
      {
        ...PRODUCER_ALFA,
        id: "producer-2",
        user: { ...PRODUCER_ALFA.user!, fullName: "Bruno Silva", email: "bruno@agro.com" },
      },
    ]);

    render(<CommunityProducersPage communityId="community-alfa" />);
    await screen.findByText("Ana Alves");

    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.type(
      screen.getByPlaceholderText("Buscar por nome, e-mail, CPF ou nome local…"),
      "bruno@agro.com",
    );
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    vi.useRealTimers();

    await waitFor(() => {
      expect(screen.getByText("Bruno Silva")).toBeTruthy();
      expect(screen.queryByText("Ana Alves")).toBeNull();
    });
  });

  it("UNIT-002: agricultor sem user mostra o CPF próprio e é encontrado pela busca por CPF", async () => {
    loginAs("ADMIN");
    vi.mocked(listProducers).mockResolvedValue([
      PRODUCER_ALFA,
      {
        ...PRODUCER_ALFA,
        id: "producer-2",
        fullName: "Carla Sem Usuário",
        cpf: "52998224725",
        user: null,
      },
    ]);

    render(<CommunityProducersPage communityId="community-alfa" />);
    await screen.findByText("Carla Sem Usuário");
    expect(screen.getByText("529.982.247-25")).toBeTruthy();

    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.type(
      screen.getByPlaceholderText("Buscar por nome, e-mail, CPF ou nome local…"),
      "52998224725",
    );
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    vi.useRealTimers();

    await waitFor(() => {
      expect(screen.getByText("Carla Sem Usuário")).toBeTruthy();
      expect(screen.queryByText("Ana Alves")).toBeNull();
    });
  });

  it("pagina a lista em blocos de dez produtores", async () => {
    loginAs("ADMIN");
    const producers = Array.from({ length: 11 }, (_, index) => ({
      ...PRODUCER_ALFA,
      id: `producer-${index + 1}`,
      user: {
        ...PRODUCER_ALFA.user!,
        fullName: `Produtor ${String(index + 1).padStart(2, "0")}`,
      },
    }));
    vi.mocked(listProducers).mockResolvedValue(producers);

    render(<CommunityProducersPage communityId="community-alfa" />);
    await screen.findByText("Produtor 01");

    expect(screen.getByText("Produtor 10")).toBeTruthy();
    expect(screen.queryByText("Produtor 11")).toBeNull();

    await userEvent.setup().click(
      screen.getByRole("button", { name: "Próxima página" }),
    );

    expect(screen.getByText("Produtor 11")).toBeTruthy();
    expect(screen.queryByText("Produtor 01")).toBeNull();
  });
});

describe("CommunityProducersPage — ordenação e layout mobile", () => {
  afterEach(() => {
    vi.mocked(useIsMobile).mockReturnValue(false);
  });

  it("lista os agricultores em ordem alfabética por nome por padrão", async () => {
    loginAs("ADMIN");
    vi.mocked(listProducers).mockResolvedValue([
      {
        ...PRODUCER_ALFA,
        id: "producer-c",
        user: { ...PRODUCER_ALFA.user!, fullName: "Carlos Costa" },
      },
      PRODUCER_ALFA,
      {
        ...PRODUCER_ALFA,
        id: "producer-b",
        user: { ...PRODUCER_ALFA.user!, fullName: "Bruno Silva" },
      },
    ]);

    render(<CommunityProducersPage communityId="community-alfa" />);
    await screen.findByText("Ana Alves");

    const names = screen
      .getAllByRole("row")
      .slice(1)
      .map((row) => row.querySelectorAll("td")[0]?.textContent);
    expect(names).toEqual(["Ana Alves", "Bruno Silva", "Carlos Costa"]);
  });

  it("em viewport mobile renderiza cards com as ações, sem <table>", async () => {
    loginAs("ADMIN");
    vi.mocked(useIsMobile).mockReturnValue(true);

    render(<CommunityProducersPage communityId="community-alfa" />);

    expect(await screen.findByText("Ana Alves")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText("Em conformidade")).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Editar agricultor/ })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /^Excluir agricultor/ }),
    ).toBeTruthy();
  });
});

describe("CommunityProducersPage — visual do redesign", () => {
  it("breadcrumb de 3 níveis acima do h2, CPF tabular e conformidade em Badge", async () => {
    loginAs("ADMIN");
    vi.mocked(listProducers).mockResolvedValue([
      PRODUCER_ALFA,
      {
        ...PRODUCER_ALFA,
        id: "producer-2",
        isCompliant: false,
        user: { ...PRODUCER_ALFA.user!, id: "user-2", fullName: "Bruno Pendente" },
      },
      {
        ...PRODUCER_ALFA,
        id: "producer-3",
        isCompliant: null,
        cpf: null,
        user: { ...PRODUCER_ALFA.user!, id: "user-3", fullName: "Caio Sem Dados", cpf: "" },
      },
    ]);

    render(<CommunityProducersPage communityId="community-alfa" />);

    const heading = await screen.findByRole("heading", { level: 2, name: "Comunidade Alfa" });
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(nav.textContent).toContain("Organizações");
    expect(nav.textContent).toContain("Comunidade Alfa");
    expect(
      nav.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    await screen.findByText("Bruno Pendente");
    const ok = screen.getByText("Em conformidade");
    expect(ok.className).toContain("bg-success-muted");
    // Status de sucesso leva o ícone (CircleCheck), decorativo.
    expect(ok.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    const pending = screen.getByText("Pendente");
    expect(pending.className).toContain("bg-warning-muted");
    expect(pending.className).not.toMatch(/amber|emerald/);

    const cpf = screen.getAllByText("123.456.789-01", { selector: "td" })[0];
    expect(cpf.className).toContain("tabular-nums");
    expect(cpf.className).not.toContain("font-mono");
    // Sem CPF, sem nome local e sem conformidade: "sem dados" para leitor de tela.
    const caioRow = screen.getByText("Caio Sem Dados").closest("tr") as HTMLElement;
    expect(within(caioRow).getAllByText("sem dados")).toHaveLength(3);
  });

  it("lista vazia: dica e CTA que abre o drawer de cadastro", async () => {
    loginAs("ADMIN");
    vi.mocked(listProducers).mockResolvedValue([]);

    render(<CommunityProducersPage communityId="community-alfa" />);

    expect(
      await screen.findByText(
        "Cadastre o primeiro agricultor desta comunidade com os dados pessoais, o endereço e o acesso dele ao painel.",
      ),
    ).toBeTruthy();
    await userEvent.setup().click(
      screen.getByRole("button", { name: "Criar primeiro agricultor" }),
    );
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });
});

describe("CommunityProducersPage — diálogo de exclusão (UX-L3-02)", () => {
  it("avisa da perda de acesso ao painel e que agricultor com planos não pode ser excluído", async () => {
    loginAs("ADMIN");

    render(<CommunityProducersPage communityId="community-alfa" />);

    await userEvent.setup().click(
      await screen.findByRole("button", { name: "Excluir agricultor Ana Alves" }),
    );
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("Ana Alves (CPF 123.456.789-01)");
    expect(dialog.textContent).toContain("e o acesso dele ao painel");
    expect(dialog.textContent).toContain(
      "Agricultores com planos de produção não podem ser excluídos.",
    );
  });
});

describe("CommunityProducersPage — exclusão de agricultor sem login", () => {
  it("sem usuário vinculado: não fala de acesso ao painel e, sem CPF, não mostra parênteses", async () => {
    loginAs("ADMIN");
    vi.mocked(listProducers).mockResolvedValue([
      { ...PRODUCER_ALFA, id: "producer-9", fullName: "Sem Login", cpf: null, user: null },
    ]);

    render(<CommunityProducersPage communityId="community-alfa" />);

    await userEvent.setup().click(
      await screen.findByRole("button", { name: "Excluir agricultor Sem Login" }),
    );
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("Sem Login");
    expect(dialog.textContent).not.toContain("acesso dele ao painel");
    expect(dialog.textContent).not.toContain("(CPF");
    expect(dialog.textContent).toContain(
      "Agricultores com planos de produção não podem ser excluídos.",
    );
  });
});

