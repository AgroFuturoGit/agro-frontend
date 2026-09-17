import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
};

const CROPS: RawCrop[] = [
  { id: "c-1", name: "Soja", variety: "Convencional", isPriority: true },
  { id: "c-2", name: "Milho", variety: "Transgênico", isPriority: false },
  { id: "c-3", name: "Trigo", variety: "Precoce", isPriority: false },
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

  it("role=TECHNICIAN: também gerencia (exibe 'Nova cultura' e editar)", async () => {
    await mockRole("TECHNICIAN");
    await mockMobile(false);
    await mockCropsApi();

    await renderCropsPage();

    expect(screen.getByRole("button", { name: /Nova cultura/ })).toBeTruthy();
    expect(
      screen.getAllByRole("button", { name: /Editar/ }).length,
    ).toBeGreaterThan(0);
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
      screen.getAllByRole("button", { name: "Excluir cultura" })[0],
    );

    expect(await screen.findByText("Excluir cultura")).toBeTruthy();
    expect(
      screen.getByText(
        (_, node) =>
          node?.textContent === "Esta ação removerá Soja do sistema. Não é possível desfazer.",
      ),
    ).toBeTruthy();
  });

  it("role=FARMER: nenhum botão 'Excluir cultura' aparece, mesmo com linhas na lista", async () => {
    await mockRole("FARMER");
    await mockMobile(false);
    await mockCropsApi();

    await renderCropsPage();

    expect(screen.queryByRole("button", { name: "Excluir cultura" })).toBeNull();
  });

  it("em viewport mobile, a ação de excluir também fica acessível quando canManage", async () => {
    await mockRole("ADMIN");
    await mockMobile(true);
    await mockCropsApi();

    await renderCropsPage();

    expect(
      screen.getAllByRole("button", { name: "Excluir cultura" }).length,
    ).toBeGreaterThan(0);
  });

  it("em viewport mobile sem permissão de escrita, nenhuma ação de excluir aparece", async () => {
    await mockRole("FARMER");
    await mockMobile(true);
    await mockCropsApi();

    await renderCropsPage();

    expect(screen.queryByRole("button", { name: "Excluir cultura" })).toBeNull();
  });
});
