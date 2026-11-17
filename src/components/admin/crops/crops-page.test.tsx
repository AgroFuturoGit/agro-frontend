import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CropsPage } from "@/components/admin/crops/crops-page";
import type { Role } from "@/lib/auth";

/**
 * Rede de segurança escrita ANTES da migração para `DataTable` — cobre
 * comportamento observável da tela, não a implementação atual (`<Table>`
 * cru + debounce manual). O mock fica na fronteira de transporte
 * (`apiRequest`), não em `listCrops`: assim a filtragem client-side de
 * `listCrops` (pré-migração) continua sendo exercitada de verdade, e o
 * teste permanece válido depois da migração — quando a mesma filtragem
 * passa a viver no `globalFilter` da tabela em vez de dentro do wrapper.
 */
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, apiRequest: vi.fn() };
});

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return { ...actual, readUserFromStorage: vi.fn() };
});

vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: vi.fn() }));

type RawCrop = {
  id: string;
  name: string;
  variety: string;
  isPriority: boolean;
  cycleDays: number | null;
  expectedProductivity: number | null;
  harvestType: "SINGLE" | "CONTINUOUS" | null;
  unit: "KG" | "TON" | "SACK" | "BOX" | null;
  unitWeightKg: number | null;
};

const CROPS: RawCrop[] = [
  {
    id: "c-1",
    name: "Soja",
    variety: "Convencional",
    isPriority: true,
    cycleDays: 120,
    expectedProductivity: 3200,
    harvestType: "SINGLE",
    unit: "SACK",
    unitWeightKg: 60,
  },
  {
    id: "c-2",
    name: "Milho",
    variety: "Transgênico",
    isPriority: false,
    cycleDays: null,
    expectedProductivity: 6000,
    harvestType: "SINGLE",
    unit: "TON",
    unitWeightKg: 1000,
  },
  {
    id: "c-3",
    name: "Trigo",
    variety: "Precoce",
    isPriority: false,
    cycleDays: null,
    expectedProductivity: null,
    harvestType: null,
    unit: null,
    unitWeightKg: null,
  },
];

async function mockRole(role: Role | null) {
  const auth = await import("@/lib/auth");
  vi.mocked(auth.readUserFromStorage).mockReturnValue(
    role
      ? {
          id: "current",
          fullName: "Usuário Atual",
          email: "atual@agro.com",
          cpf: "00000000000",
          role,
          dateOfBirth: null,
        }
      : null,
  );
}

async function mockMobile(isMobile: boolean) {
  const hook = await import("@/hooks/use-mobile");
  vi.mocked(hook.useIsMobile).mockReturnValue(isMobile);
}

async function mockCropsApi(crops: RawCrop[] = CROPS) {
  const api = await import("@/lib/api");
  vi.mocked(api.apiRequest).mockImplementation(async (path: unknown) => {
    if (path === "/crops") return crops as never;
    throw new Error(`endpoint inesperado no mock: ${String(path)}`);
  });
}

async function mockCropsApiError(message: string) {
  const api = await import("@/lib/api");
  vi.mocked(api.apiRequest).mockImplementation(async (path: unknown) => {
    if (path === "/crops") throw new api.ApiError(500, message, null);
    throw new Error(`endpoint inesperado no mock: ${String(path)}`);
  });
}

/**
 * Espera pelo nome "Soja" numa célula de tabela (desktop) OU num parágrafo
 * de card (mobile, onde o texto fica "Soja — Convencional" no mesmo nó).
 * Um matcher de leaf-node (`children.length === 0`) evita casar também com
 * os `<div>` ancestrais que também contêm "Soja" na sua textContent
 * concatenada.
 */
async function renderCropsPage() {
  const result = render(<CropsPage />);
  await screen.findByText(
    (_, node) =>
      Boolean(node?.textContent?.includes("Soja")) &&
      node?.children.length === 0,
  );
  return result;
}

describe("CropsPage — listagem", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renderiza uma linha por cultura retornada pela API", async () => {
    await mockRole("ADMIN");
    await mockMobile(false);
    await mockCropsApi();

    await renderCropsPage();

    expect(screen.getByText("Milho")).toBeTruthy();
    expect(screen.getByText("Trigo")).toBeTruthy();
  });

  it("mostra tipo de colheita e unidade, com — para cultura legada sem esses dados", async () => {
    await mockRole("ADMIN");
    await mockMobile(false);
    await mockCropsApi();

    await renderCropsPage();

    expect(screen.getAllByText("Colheita única").length).toBe(2);
    expect(screen.getByText("Saca")).toBeTruthy();
    expect(screen.getByText("Tonelada (t)")).toBeTruthy();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });
});

describe("CropsPage — busca livre", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("digitar no campo de busca filtra a lista para as culturas correspondentes", async () => {
    const user = userEvent.setup();
    await mockRole("ADMIN");
    await mockMobile(false);
    await mockCropsApi();

    await renderCropsPage();

    await user.type(
      screen.getByPlaceholderText("Buscar por nome ou variedade…"),
      "Trigo",
    );

    await waitFor(
      () => {
        expect(screen.getByText("Trigo")).toBeTruthy();
        expect(screen.queryByText("Soja")).toBeNull();
        expect(screen.queryByText("Milho")).toBeNull();
      },
      { timeout: 3000 },
    );
  });

  it("buscar um termo sem correspondência esconde todos os registros", async () => {
    const user = userEvent.setup();
    await mockRole("ADMIN");
    await mockMobile(false);
    await mockCropsApi();

    await renderCropsPage();

    await user.type(
      screen.getByPlaceholderText("Buscar por nome ou variedade…"),
      "Sorgo",
    );

    await waitFor(
      () => {
        expect(screen.queryByText("Soja")).toBeNull();
        expect(screen.queryByText("Milho")).toBeNull();
        expect(screen.queryByText("Trigo")).toBeNull();
      },
      { timeout: 3000 },
    );
  });
});

describe("CropsPage — filtro de prioritárias", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("marcar 'Somente prioritárias' reduz a lista às culturas prioritárias", async () => {
    const user = userEvent.setup();
    await mockRole("ADMIN");
    await mockMobile(false);
    await mockCropsApi();

    await renderCropsPage();

    await user.click(
      screen.getByRole("checkbox", { name: /Somente prioritárias/ }),
    );

    await waitFor(() => {
      expect(screen.getByText("Soja")).toBeTruthy();
      expect(screen.queryByText("Milho")).toBeNull();
      expect(screen.queryByText("Trigo")).toBeNull();
    });
  });
});

describe("CropsPage — RBAC", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("role=ADMIN: exibe 'Nova cultura' e ação de editar em cada linha", async () => {
    await mockRole("ADMIN");
    await mockMobile(false);
    await mockCropsApi();

    await renderCropsPage();

    expect(screen.getByRole("button", { name: /Nova cultura/ })).toBeTruthy();
    expect(
      screen.getAllByRole("button", { name: /Editar/ }).length,
    ).toBeGreaterThan(0);
  });

  it("role=TECHNICIAN: só lê (sem 'Nova cultura', editar nem excluir), com a lista visível", async () => {
    await mockRole("TECHNICIAN");
    await mockMobile(false);
    await mockCropsApi();

    await renderCropsPage();

    expect(screen.queryByRole("button", { name: /Nova cultura/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Editar/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Excluir cultura/ })).toBeNull();
    expect(screen.getAllByRole("row").length).toBeGreaterThan(1);
  });

  it("role=TECHNICIAN: lista vazia não mostra a ação 'Criar primeira cultura'", async () => {
    await mockRole("TECHNICIAN");
    await mockMobile(false);
    await mockCropsApi([]);

    render(<CropsPage />);

    expect(await screen.findByText("Nenhuma cultura cadastrada.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Criar primeira cultura" })).toBeNull();
  });

  it("role=FARMER: nenhuma ação de escrita aparece, mesmo com linhas na lista", async () => {
    await mockRole("FARMER");
    await mockMobile(false);
    await mockCropsApi();

    await renderCropsPage();

    expect(screen.queryByRole("button", { name: /Nova cultura/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Editar/ })).toBeNull();
  });

  it("role=MANAGER: nenhuma ação de escrita aparece, mesmo com linhas na lista", async () => {
    await mockRole("MANAGER");
    await mockMobile(false);
    await mockCropsApi();

    await renderCropsPage();

    expect(screen.queryByRole("button", { name: /Nova cultura/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Editar/ })).toBeNull();
  });
});

describe("CropsPage — estado vazio", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("lista vazia sem filtro mostra a mensagem de nenhuma cultura cadastrada", async () => {
    await mockRole("ADMIN");
    await mockMobile(false);
    await mockCropsApi([]);

    render(<CropsPage />);

    expect(await screen.findByText("Nenhuma cultura cadastrada.")).toBeTruthy();
  });
});

describe("CropsPage — estado de erro", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("falha ao carregar exibe alerta com ação de tentar novamente, que recarrega a lista", async () => {
    const user = userEvent.setup();
    await mockRole("ADMIN");
    await mockMobile(false);
    await mockCropsApiError("Não foi possível carregar as culturas.");

    render(<CropsPage />);

    // A mensagem específica capturada em `error` (ex.: "Não foi possível
    // carregar as culturas.") deixa de ser exibida literalmente depois da
    // migração para `DataTable`: o componente compartilhado usa a mesma
    // cópia genérica em TODAS as telas que o adotam — `hasError` vira só um
    // booleano (`UsersPage` já se comporta assim hoje, sem jamais mostrar
    // a mensagem específica da API). É uma mudança de comportamento
    // intencional e consistente com o padrão, não uma regressão: o que
    // continua garantido é o essencial — role="alert" e a ação "Tentar
    // novamente" recarregando a lista.
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Não foi possível carregar os dados.");

    await mockCropsApi();
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

    await screen.findByText("Soja");
  });
});

describe("CropsPage — layout mobile", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("em viewport mobile, renderiza cards (sem <table>) com a ação de editar acessível", async () => {
    await mockRole("ADMIN");
    await mockMobile(true);
    await mockCropsApi();

    await renderCropsPage();

    expect(screen.queryByRole("table")).toBeNull();
    expect(
      screen.getAllByRole("button", { name: /Editar/ }).length,
    ).toBeGreaterThan(0);
  });

  it("em viewport mobile sem permissão de escrita, nenhuma ação de editar aparece", async () => {
    await mockRole("FARMER");
    await mockMobile(true);
    await mockCropsApi();

    await renderCropsPage();

    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("button", { name: /Editar/ })).toBeNull();
  });
});

/**
 * Testes adicionados DEPOIS da migração para `DataTable`: Culturas ganhou
 * a ação de excluir que faltava (`DeleteCropDialog`), gateada por
 * `canManage`. Não fazem parte da rede de segurança do passo 1 — não
 * existiam antes porque a funcionalidade também não existia.
 */
describe("CropsPage — integração com DeleteCropDialog", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("clicar em 'Excluir cultura' abre o diálogo de confirmação com a cultura certa", async () => {
    const user = userEvent.setup();
    await mockRole("ADMIN");
    await mockMobile(false);
    await mockCropsApi();

    await renderCropsPage();

    await user.click(
      screen.getAllByRole("button", { name: /^Excluir cultura/ })[0],
    );

    expect(await screen.findByText("Excluir cultura")).toBeTruthy();
    expect(
      screen.getByText(
        (_, node) =>
          node?.textContent === "Esta ação removerá Soja — Convencional do sistema. Não é possível desfazer.",
      ),
    ).toBeTruthy();
  });

  it("role=FARMER: nenhum botão 'Excluir cultura' aparece, mesmo com linhas na lista", async () => {
    await mockRole("FARMER");
    await mockMobile(false);
    await mockCropsApi();

    await renderCropsPage();

    expect(screen.queryByRole("button", { name: /^Excluir cultura/ })).toBeNull();
  });

  it("em viewport mobile, a ação de excluir também fica acessível quando canManage", async () => {
    await mockRole("ADMIN");
    await mockMobile(true);
    await mockCropsApi();

    await renderCropsPage();

    expect(
      screen.getAllByRole("button", { name: /^Excluir cultura/ }).length,
    ).toBeGreaterThan(0);
  });

  it("em viewport mobile sem permissão de escrita, nenhuma ação de excluir aparece", async () => {
    await mockRole("FARMER");
    await mockMobile(true);
    await mockCropsApi();

    await renderCropsPage();

    expect(screen.queryByRole("button", { name: /^Excluir cultura/ })).toBeNull();
  });
});

describe("CropsPage — visual do Figma (lote 2)", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("'Somente prioritárias' fica dentro do card da toolbar, junto da busca", async () => {
    await mockRole("ADMIN");
    await mockMobile(false);
    await mockCropsApi();

    await renderCropsPage();

    const checkbox = screen.getByRole("checkbox", { name: /Somente prioritárias/ });
    const search = screen.getByRole("searchbox");
    const toolbarCard = search.closest(".rounded-xl");
    expect(toolbarCard).toBeTruthy();
    expect(toolbarCard?.contains(checkbox)).toBe(true);
  });

  it("título em PageHeader (h2) e badge 'Prioritária' outline", async () => {
    await mockRole("ADMIN");
    await mockMobile(false);
    await mockCropsApi();

    await renderCropsPage();

    expect(
      screen.getByRole("heading", { level: 2, name: "Culturas Agrícolas" }),
    ).toBeTruthy();
    // "Prioritária" também é o cabeçalho da coluna: busca o badge da linha.
    const badge = screen
      .getAllByText("Prioritária")
      .find((el) => el.getAttribute("data-slot") === "badge");
    expect(badge).toBeTruthy();
    expect(badge?.className).toMatch(/\bborder-border\b/);
  });
});


/** O `role=status` do estado vazio (a paginação também tem um `status`). */
async function emptyStatus(title: string) {
  const node = await screen.findByText(title);
  return node.closest('[role="status"]') as HTMLElement;
}

describe("CropsPage — ajustes da revisão (lote 2)", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("vazio sem filtro: dica e CTA 'Criar primeira cultura' que abre o drawer", async () => {
    await mockRole("ADMIN");
    await mockMobile(false);
    await mockCropsApi([]);
    const user = userEvent.setup();

    render(<CropsPage />);

    const status = await emptyStatus("Nenhuma cultura cadastrada.");
    expect(status).toHaveTextContent("Nenhuma cultura cadastrada.");
    expect(status).toHaveTextContent(/planos de produção/);
    await user.click(screen.getByRole("button", { name: "Criar primeira cultura" }));
    expect(await screen.findByRole("heading", { name: "Nova cultura" })).toBeTruthy();
  });

  it("vazio sem permissão: só a dica, sem CTA", async () => {
    await mockRole("FARMER");
    await mockMobile(false);
    await mockCropsApi([]);

    render(<CropsPage />);

    const status = await emptyStatus("Nenhuma cultura cadastrada.");
    expect(status).toHaveTextContent(/administrador ou técnico/);
    expect(screen.queryByRole("button", { name: "Criar primeira cultura" })).toBeNull();
  });

  it("'Limpar' da toolbar também desmarca 'Somente prioritárias'", async () => {
    await mockRole("ADMIN");
    await mockMobile(false);
    await mockCropsApi();
    const user = userEvent.setup();

    await renderCropsPage();

    const checkbox = screen.getByRole("checkbox", { name: /Somente prioritárias/ });
    await user.click(checkbox);
    expect(checkbox).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("button", { name: "Remover filtro Somente prioritárias" }),
    ).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Limpar" }));
    expect(checkbox).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("Milho")).toBeTruthy();
  });

  it("ações de linha nomeiam a cultura (nome — variedade)", async () => {
    await mockRole("ADMIN");
    await mockMobile(false);
    await mockCropsApi();

    await renderCropsPage();

    expect(
      screen.getByRole("button", { name: "Editar cultura Soja — Convencional" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Excluir cultura Milho — Transgênico" }),
    ).toBeTruthy();
  });

  it("mobile: ações iguais às da tabela, irmãs do bloco do nome", async () => {
    await mockRole("ADMIN");
    await mockMobile(true);
    await mockCropsApi();

    await renderCropsPage();

    const name = screen.getByText("Soja — Convencional");
    const card = name.parentElement?.parentElement as HTMLElement;
    expect(
      within(card).getByRole("button", { name: /^Editar cultura Soja/ }),
    ).toBeTruthy();
    expect(
      within(card).getByRole("button", { name: /^Excluir cultura Soja/ }),
    ).toBeTruthy();
  });
});

describe("CropsPage — lacunas do QA e M1 (lote 2)", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("vazio por 'Somente prioritárias': 'Limpar filtros' desmarca o checkbox e restaura a lista", async () => {
    await mockRole("ADMIN");
    await mockMobile(false);
    await mockCropsApi(CROPS.map((crop) => ({ ...crop, isPriority: false })));
    const user = userEvent.setup();

    await renderCropsPage();

    const checkbox = screen.getByRole("checkbox", { name: /Somente prioritárias/ });
    await user.click(checkbox);

    expect(
      await screen.findByText("Nenhum resultado para os filtros aplicados."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Criar primeira cultura" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(checkbox).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("Soja")).toBeInTheDocument();
    expect(screen.getAllByRole("row").length).toBe(CROPS.length + 1);
  });

  it("M1: 'Limpar filtros' do vazio também esvazia o campo de busca", async () => {
    await mockRole("ADMIN");
    await mockMobile(false);
    await mockCropsApi();
    const user = userEvent.setup();

    await renderCropsPage();

    const search = screen.getByRole("searchbox");
    await user.type(search, "zzz");
    expect(
      await screen.findByText("Nenhum resultado para os filtros aplicados."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(search).toHaveValue("");
    expect(screen.getByText("Soja")).toBeInTheDocument();
    // O debounce não reaplica o texto antigo depois de limpo.
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(search).toHaveValue("");
    expect(screen.getByText("Milho")).toBeInTheDocument();
  });

  it("M1: digitar 1–2 caracteres (que não filtram) não apaga o campo", async () => {
    await mockRole("ADMIN");
    await mockMobile(false);
    await mockCropsApi();
    const user = userEvent.setup();

    await renderCropsPage();

    const search = screen.getByRole("searchbox");
    await user.type(search, "so");
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(search).toHaveValue("so");
  });

  it("diálogo de exclusão de cultura sem variedade mostra só o nome", async () => {
    await mockRole("ADMIN");
    await mockMobile(false);
    await mockCropsApi([{ ...CROPS[0], name: "Cana", variety: "" }]);
    const user = userEvent.setup();

    render(<CropsPage />);
    await user.click(await screen.findByRole("button", { name: "Excluir cultura Cana" }));

    expect(
      screen.getByText(
        (_, node) =>
          node?.textContent === "Esta ação removerá Cana do sistema. Não é possível desfazer.",
      ),
    ).toBeInTheDocument();
  });

  it.each([false, true])(
    "Colheita/Unidade ausentes: '—' oculto e 'sem dados' para leitor de tela (mobile=%s)",
    async (isMobile) => {
      await mockRole("ADMIN");
      await mockMobile(isMobile);
      await mockCropsApi([CROPS[2]]);

      render(<CropsPage />);

      const nodes = await screen.findAllByText("sem dados");
      expect(nodes).toHaveLength(2);
      nodes.forEach((node) => {
        expect(node.className).toMatch(/\bsr-only\b/);
        expect(node.previousElementSibling?.getAttribute("aria-hidden")).toBe("true");
        expect(node.previousElementSibling?.textContent).toBe("—");
      });
    },
  );
});
