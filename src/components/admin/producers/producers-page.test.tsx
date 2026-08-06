import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import { ProducersPage } from "@/components/admin/producers/producers-page";
import { ApiError } from "@/lib/api";
import { readUserFromStorage, type AuthUser, type Role } from "@/lib/auth";
import { listCommunities, type Community } from "@/lib/communities";
import { getMyManager, type Manager } from "@/lib/managers";
import { listProducers, type Producer } from "@/lib/producers";
import type { Organization } from "@/lib/organizations";

// Nenhum acesso de rede real: os clientes de domínio são mockados por
// completo, então `apiRequest` nunca chega a ser alcançado (mesmo padrão de
// `production-plans-page.test.tsx`). O resto de cada módulo é preservado via
// `importActual` porque a página e seus diálogos usam outros exports
// (`registerProducer`, `formatCpf`, tipos).
vi.mock("@/lib/producers", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/producers")>("@/lib/producers");
  return { ...actual, listProducers: vi.fn() };
});

vi.mock("@/lib/communities", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/communities")>(
      "@/lib/communities",
    );
  return { ...actual, listCommunities: vi.fn() };
});

vi.mock("@/lib/managers", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/managers")>("@/lib/managers");
  return { ...actual, getMyManager: vi.fn() };
});

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

/** As duas comunidades da organização do MANAGER logado. */
const MY_COMMUNITIES: Community[] = [
  {
    id: "community-alfa",
    name: "Comunidade Alfa",
    organization: MY_ORGANIZATION,
  },
  {
    id: "community-beta",
    name: "Comunidade Beta",
    organization: MY_ORGANIZATION,
  },
];

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
  aliasName: null,
  isCompliant: true,
  user: {
    id: "user-1",
    fullName: "Ana Alves",
    email: "ana@agro.com",
    cpf: "12345678901",
  },
  community: { id: "community-alfa", name: "Comunidade Alfa" },
};

const PRODUCER_BETA: Producer = {
  id: "producer-2",
  aliasName: null,
  isCompliant: true,
  user: {
    id: "user-2",
    fullName: "Bruno Barros",
    email: "bruno@agro.com",
    cpf: "12345678902",
  },
  community: { id: "community-beta", name: "Comunidade Beta" },
};

/**
 * Produtor de uma comunidade de OUTRA organização. `GET /producers` sem
 * `communityId` devolve produtores de todas as organizações — o backend não
 * impõe escopo hierárquico nenhum (`memory/backend-hierarchy-ownership`).
 */
const PRODUCER_OUTRA_ORG: Producer = {
  id: "producer-3",
  aliasName: null,
  isCompliant: true,
  user: {
    id: "user-3",
    fullName: "Carla Costa",
    email: "carla@agro.com",
    cpf: "12345678903",
  },
  community: { id: "community-externa", name: "Comunidade Externa" },
};

const ALL_PRODUCERS: Producer[] = [
  PRODUCER_ALFA,
  PRODUCER_BETA,
  PRODUCER_OUTRA_ORG,
];

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

/** Item atualmente destacado no popup aberto do `Select`. */
function highlightedOption(): HTMLElement {
  const highlighted = screen
    .getAllByRole("option")
    .find((option) => option.getAttribute("data-highlighted") !== null);
  expect(highlighted).toBeTruthy();
  return highlighted as HTMLElement;
}

/**
 * O `Select` do `@base-ui/react` é portalizado e só confirma o item
 * DESTACADO — clique em item não destacado é ignorado no jsdom. Abrimos pelo
 * teclado a partir do trigger (o valor atual já entra destacado) e caminhamos
 * até o alvo antes de confirmar com Enter.
 */
async function selectCommunityFilter(label: string) {
  const trigger = screen.getByLabelText("Comunidade");
  await waitFor(() => {
    expect(trigger.hasAttribute("disabled")).toBe(false);
    expect(trigger.getAttribute("data-disabled")).toBeNull();
  });

  trigger.focus();
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  fireEvent.keyUp(trigger, { key: "ArrowDown" });

  const target = await screen.findByRole("option", { name: label });
  const options = screen.getAllByRole("option");
  const from = options.indexOf(highlightedOption());
  const to = options.indexOf(target);

  const key = to > from ? "ArrowDown" : "ArrowUp";
  for (let step = 0; step < Math.abs(to - from); step += 1) {
    const current = highlightedOption();
    fireEvent.keyDown(current, { key });
    fireEvent.keyUp(current, { key });
  }

  expect(highlightedOption()).toBe(target);
  fireEvent.keyDown(target, { key: "Enter" });
  fireEvent.keyUp(target, { key: "Enter" });
}

/** Nomes dos produtores efetivamente renderizados na primeira coluna. */
function renderedProducerNames() {
  return screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => row.querySelector("td")?.textContent ?? "")
    .filter((name) => name.length > 0);
}

beforeEach(() => {
  vi.mocked(readUserFromStorage).mockReturnValue(null);
  vi.mocked(listProducers).mockResolvedValue(ALL_PRODUCERS);
  vi.mocked(listCommunities).mockResolvedValue(MY_COMMUNITIES);
  vi.mocked(getMyManager).mockResolvedValue(MY_MANAGER);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ProducersPage — escopo por organização e filtro (spec.md §3.4)", () => {
  it("MANAGER: só vê os produtores das comunidades da própria organização (RN1/RN2)", async () => {
    loginAs("MANAGER");

    render(<ProducersPage />);

    // RN1: a organização é resolvida UMA ÚNICA VEZ, pela página.
    await waitFor(() => expect(getMyManager).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(listCommunities).toHaveBeenCalledExactlyOnceWith("org-a"),
    );

    // Os dois produtores da organização A aparecem...
    expect(await screen.findByText("Ana Alves")).toBeTruthy();
    expect(screen.getByText("Bruno Barros")).toBeTruthy();

    // ...e o terceiro, de comunidade de outra organização, NÃO aparece —
    // ainda que `GET /producers` o tenha devolvido (barreira de UX, não de
    // segurança: o dado trafega até o navegador e some na renderização).
    expect(listProducers).toHaveBeenCalledExactlyOnceWith();
    expect(screen.queryByText("Carla Costa")).toBeNull();
    expect(screen.queryByText("Comunidade Externa")).toBeNull();
    expect(renderedProducerNames()).toEqual(["Ana Alves", "Bruno Barros"]);
  });

  it("ADMIN: não resolve organização e vê todos os produtores", async () => {
    loginAs("ADMIN");

    render(<ProducersPage />);

    expect(await screen.findByText("Carla Costa")).toBeTruthy();
    expect(screen.getByText("Ana Alves")).toBeTruthy();
    expect(screen.getByText("Bruno Barros")).toBeTruthy();
    expect(renderedProducerNames()).toEqual([
      "Ana Alves",
      "Bruno Barros",
      "Carla Costa",
    ]);

    // `GET /managers/me` é exclusivo do MANAGER; ADMIN lista comunidades sem
    // escopo de organização.
    expect(getMyManager).not.toHaveBeenCalled();
    expect(listCommunities).toHaveBeenCalledExactlyOnceWith();
  });

  it("escolher uma comunidade no filtro busca os produtores daquela comunidade", async () => {
    loginAs("MANAGER");

    render(<ProducersPage />);
    expect(await screen.findByText("Ana Alves")).toBeTruthy();
    expect(listProducers).toHaveBeenCalledExactlyOnceWith();

    // Segunda comunidade da lista: exercita a navegação por teclado e prova
    // que o id enviado é o da comunidade ESCOLHIDA, não o da primeira.
    await selectCommunityFilter("Comunidade Beta");

    await waitFor(() =>
      expect(vi.mocked(listProducers).mock.calls.at(-1)).toEqual([
        "community-beta",
      ]),
    );
    // O filtro não re-resolve a organização nem recarrega as comunidades.
    expect(getMyManager).toHaveBeenCalledTimes(1);
    expect(listCommunities).toHaveBeenCalledTimes(1);
  });

  it("voltar para 'Todas as comunidades' busca a listagem sem filtro", async () => {
    loginAs("MANAGER");

    render(<ProducersPage />);
    expect(await screen.findByText("Ana Alves")).toBeTruthy();

    await selectCommunityFilter("Comunidade Alfa");
    await waitFor(() =>
      expect(vi.mocked(listProducers).mock.calls.at(-1)).toEqual([
        "community-alfa",
      ]),
    );

    await selectCommunityFilter("Todas as comunidades");

    // Sem argumento: o sentinela "all" nunca vaza para a query string.
    await waitFor(() =>
      expect(vi.mocked(listProducers).mock.calls.at(-1)).toEqual([]),
    );
  });

  /**
   * COBERTURA DE TECHNICIAN E PRODUCER REMOVIDA — gap I6 do `qa-report.md`.
   *
   * Este teste também afirmava o comportamento de TECHNICIAN e PRODUCER em
   * `/admin/produtores`. Só que `/admin/produtores` está em
   * `ADMIN_OR_MANAGER_PREFIXES` (`src/proxy.ts`): o proxy redireciona as duas
   * roles para `/admin` antes de a página montar, e o item de menu nem
   * aparece para elas (`sidebar-nav.tsx`). Renderizar o componente direto,
   * sem proxy, exercitava um ramo INALCANÇÁVEL em produção — o teste passava
   * sem provar nada e dava falsa sensação de cobertura.
   *
   * O que de fato precisa estar travado é o redirecionamento, e ele já tem
   * teste próprio e exaustivo em `src/proxy.test.ts` (matriz role × rota, com
   * `/admin/usuarios, /admin/produtores` → REDIRECT para TECHNICIAN e
   * PRODUCER). Se um dia o proxy liberar a rota para outra role, é lá que a
   * mudança aparece — e aí este arquivo passa a precisar do caso.
   *
   * Sobram aqui as duas roles que realmente chegam à tela: MANAGER e ADMIN.
   */
  it.each(["MANAGER", "ADMIN"] as const)(
    "%s: botão 'Novo Produtor' visível e habilitado com o escopo resolvido",
    async (role) => {
      loginAs(role);

      render(<ProducersPage />);

      expect(await screen.findByText("Ana Alves")).toBeTruthy();
      const button = screen.getByRole("button", { name: "Novo Produtor" });
      expect(button.hasAttribute("disabled")).toBe(false);
      expect(screen.getByLabelText("Comunidade")).toBeTruthy();
    },
  );
});

/**
 * Mutantes M5, M6, M8 e M9 do `qa-report.md` (gaps I1, I2 e I3): erro de API,
 * estado vazio e estado desabilitado da página sobreviviam à remoção — os 142
 * testes da fase não olhavam nenhum dos três.
 */
describe("ProducersPage — erro de API, estado vazio e escopo indisponível", () => {
  it("erro de listProducers exibe role=alert com a mensagem do ApiError (M5/M6)", async () => {
    loginAs("MANAGER");
    vi.mocked(listProducers).mockRejectedValue(
      new ApiError(500, "Erro interno do servidor", {}),
    );

    render(<ProducersPage />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Erro interno do servidor");

    // A listagem não quebra: sai do skeleton e mostra a tabela vazia.
    expect(
      await screen.findByText("Nenhum produtor cadastrado ainda."),
    ).toBeTruthy();
    // O escopo continua resolvido, então os controles seguem utilizáveis.
    expect(
      screen.getByRole("button", { name: "Novo Produtor" }).hasAttribute(
        "disabled",
      ),
    ).toBe(false);
  });

  it("erro não-ApiError de listProducers cai na mensagem genérica", async () => {
    loginAs("ADMIN");
    vi.mocked(listProducers).mockRejectedValue(new Error("boom"));

    render(<ProducersPage />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(
      "Não foi possível carregar os produtores.",
    );
  });

  it("listagem vazia mostra o estado vazio, sem skeleton e sem alerta (M8)", async () => {
    loginAs("ADMIN");
    vi.mocked(listProducers).mockResolvedValue([]);

    render(<ProducersPage />);

    expect(
      await screen.findByText("Nenhum produtor cadastrado ainda."),
    ).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(renderedProducerNames()).toEqual([
      "Nenhum produtor cadastrado ainda.",
    ]);
  });

  it("falha de getMyManager: alerta, filtro e cadastro desabilitados e listagem VAZIA (M9, fail-closed)", async () => {
    loginAs("MANAGER");
    vi.mocked(getMyManager).mockRejectedValue(new ApiError(500, "Falhou", {}));
    // O backend devolve todos os produtores mesmo sem escopo resolvido.
    vi.mocked(listProducers).mockResolvedValue(ALL_PRODUCERS);

    render(<ProducersPage />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(
      "Não foi possível carregar as comunidades: Falhou",
    );

    // INVARIANTE de UX: sem escopo resolvido NENHUM produtor é exibido —
    // jamais cair na listagem sem filtro como fallback de erro.
    expect(
      await screen.findByText("Nenhum produtor cadastrado ainda."),
    ).toBeTruthy();
    expect(screen.queryByText("Ana Alves")).toBeNull();
    expect(screen.queryByText("Bruno Barros")).toBeNull();
    expect(screen.queryByText("Carla Costa")).toBeNull();

    // `scopeUnavailable`: filtro e cadastro ficam indisponíveis.
    expect(screen.getByLabelText("Comunidade").hasAttribute("disabled")).toBe(
      true,
    );
    expect(
      screen
        .getByRole("button", { name: "Novo Produtor" })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(listCommunities).not.toHaveBeenCalled();
  });

  it("falha de listCommunities tem o mesmo efeito de fail-closed (M9)", async () => {
    loginAs("MANAGER");
    vi.mocked(listCommunities).mockRejectedValue(
      new ApiError(503, "Serviço indisponível", {}),
    );
    vi.mocked(listProducers).mockResolvedValue(ALL_PRODUCERS);

    render(<ProducersPage />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(
      "Não foi possível carregar as comunidades: Serviço indisponível",
    );

    expect(
      await screen.findByText("Nenhum produtor cadastrado ainda."),
    ).toBeTruthy();
    expect(screen.queryByText("Ana Alves")).toBeNull();

    expect(screen.getByLabelText("Comunidade").hasAttribute("disabled")).toBe(
      true,
    );
    expect(
      screen
        .getByRole("button", { name: "Novo Produtor" })
        .hasAttribute("disabled"),
    ).toBe(true);
    // A organização chegou a ser resolvida — o que faltou foram as comunidades.
    expect(getMyManager).toHaveBeenCalledTimes(1);
  });
});
