import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HarvestsPage } from "@/components/admin/harvests/harvests-page";
import type { Role } from "@/lib/auth";

/**
 * Rede de segurança escrita ANTES da migração para `DataTable` — cobre
 * comportamento observável da tela, não a implementação atual (`<Table>`
 * cru + debounce manual). O mock fica na fronteira de transporte
 * (`apiRequest`), não em `listHarvests`, para que o teste continue válido
 * depois da migração (a busca client-side muda de lugar, não de origem
 * do dado).
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

type RawHarvest = {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
};

const HARVESTS: RawHarvest[] = [
  {
    id: "h-1",
    label: "Safra 2023/2024",
    startDate: "2023-09-01",
    endDate: "2024-03-31",
  },
  {
    id: "h-2",
    label: "Safra 2024/2025",
    startDate: "2024-09-01",
    endDate: "2025-03-31",
  },
  {
    id: "h-3",
    label: "Safrinha 2025",
    startDate: "2025-02-01",
    endDate: "2025-06-30",
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

async function mockHarvestsApi(harvests: RawHarvest[] = HARVESTS) {
  const api = await import("@/lib/api");
  vi.mocked(api.apiRequest).mockImplementation(async (path: unknown) => {
    if (path === "/harvests") return harvests as never;
    throw new Error(`endpoint inesperado no mock: ${String(path)}`);
  });
}

async function mockHarvestsApiError(message: string) {
  const api = await import("@/lib/api");
  vi.mocked(api.apiRequest).mockImplementation(async (path: unknown) => {
    if (path === "/harvests") throw new api.ApiError(500, message, null);
    throw new Error(`endpoint inesperado no mock: ${String(path)}`);
  });
}

async function renderHarvestsPage() {
  const result = render(<HarvestsPage />);
  await screen.findByText("Safra 2023/2024");
  return result;
}

describe("HarvestsPage — listagem", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renderiza uma linha por safra retornada pela API", async () => {
    await mockRole("ADMIN");
    await mockMobile(false);
    await mockHarvestsApi();

    await renderHarvestsPage();

    expect(screen.getByText("Safra 2024/2025")).toBeTruthy();
    expect(screen.getByText("Safrinha 2025")).toBeTruthy();
  });
});

describe("HarvestsPage — busca livre", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("digitar no campo de busca filtra a lista para as safras correspondentes", async () => {
    const user = userEvent.setup();
    await mockRole("ADMIN");
    await mockMobile(false);
    await mockHarvestsApi();

    await renderHarvestsPage();

    await user.type(
      screen.getByPlaceholderText("Buscar por rótulo…"),
      "Safrinha",
    );

    await waitFor(
      () => {
        expect(screen.getByText("Safrinha 2025")).toBeTruthy();
        expect(screen.queryByText("Safra 2023/2024")).toBeNull();
        expect(screen.queryByText("Safra 2024/2025")).toBeNull();
      },
      { timeout: 3000 },
    );
  });

  it("buscar um termo sem correspondência esconde todos os registros", async () => {
    const user = userEvent.setup();
    await mockRole("ADMIN");
    await mockMobile(false);
    await mockHarvestsApi();

    await renderHarvestsPage();

    await user.type(
      screen.getByPlaceholderText("Buscar por rótulo…"),
      "Inexistente",
    );

    await waitFor(
      () => {
        expect(screen.queryByText("Safra 2023/2024")).toBeNull();
        expect(screen.queryByText("Safra 2024/2025")).toBeNull();
        expect(screen.queryByText("Safrinha 2025")).toBeNull();
      },
      { timeout: 3000 },
    );
  });
});

describe("HarvestsPage — RBAC", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("role=ADMIN: exibe 'Nova safra' e ações de editar/excluir em cada linha", async () => {
    await mockRole("ADMIN");
    await mockMobile(false);
    await mockHarvestsApi();

    await renderHarvestsPage();

    expect(screen.getByRole("button", { name: /Nova safra/ })).toBeTruthy();
    expect(
      screen.getAllByRole("button", { name: "Editar safra" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: "Excluir safra" }).length,
    ).toBeGreaterThan(0);
  });

  it("role=TECHNICIAN: também gerencia (exibe 'Nova safra' e editar/excluir)", async () => {
    await mockRole("TECHNICIAN");
    await mockMobile(false);
    await mockHarvestsApi();

    await renderHarvestsPage();

    expect(screen.getByRole("button", { name: /Nova safra/ })).toBeTruthy();
    expect(
      screen.getAllByRole("button", { name: "Editar safra" }).length,
    ).toBeGreaterThan(0);
  });

  it("role=FARMER: nenhuma ação de escrita aparece, mesmo com linhas na lista", async () => {
    await mockRole("FARMER");
    await mockMobile(false);
    await mockHarvestsApi();

    await renderHarvestsPage();

    expect(screen.queryByRole("button", { name: /Nova safra/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Editar safra" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Excluir safra" })).toBeNull();
  });

  it("role=MANAGER: nenhuma ação de escrita aparece, mesmo com linhas na lista", async () => {
    await mockRole("MANAGER");
    await mockMobile(false);
    await mockHarvestsApi();

    await renderHarvestsPage();

    expect(screen.queryByRole("button", { name: /Nova safra/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Editar safra" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Excluir safra" })).toBeNull();
  });
});

describe("HarvestsPage — estado vazio", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("lista vazia sem filtro mostra a mensagem de nenhuma safra cadastrada", async () => {
    await mockRole("ADMIN");
    await mockMobile(false);
    await mockHarvestsApi([]);

    render(<HarvestsPage />);

    expect(await screen.findByText("Nenhuma safra cadastrada.")).toBeTruthy();
  });
});

describe("HarvestsPage — estado de erro", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("falha ao carregar exibe alerta com ação de tentar novamente, que recarrega a lista", async () => {
    const user = userEvent.setup();
    await mockRole("ADMIN");
    await mockMobile(false);
    await mockHarvestsApiError("Não foi possível carregar as safras.");

    render(<HarvestsPage />);

    // A mensagem específica capturada em `error` deixa de ser exibida
    // literalmente depois da migração para `DataTable`: o componente
    // compartilhado usa a mesma cópia genérica em TODAS as telas que o
    // adotam — `hasError` vira só um booleano (`UsersPage` já se comporta
    // assim hoje). Mudança de comportamento intencional e consistente com
    // o padrão, não uma regressão — o essencial (role="alert" + "Tentar
    // novamente" recarregando a lista) continua garantido abaixo.
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Não foi possível carregar os dados.");

    await mockHarvestsApi();
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

    await screen.findByText("Safra 2023/2024");
  });
});

describe("HarvestsPage — integração com DeleteHarvestDialog", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("clicar em 'Excluir safra' abre o diálogo de confirmação com a safra certa", async () => {
    const user = userEvent.setup();
    await mockRole("ADMIN");
    await mockMobile(false);
    await mockHarvestsApi();

    await renderHarvestsPage();

    await user.click(
      screen.getAllByRole("button", { name: "Excluir safra" })[0],
    );

    expect(await screen.findByText("Excluir safra")).toBeTruthy();
    expect(
      screen.getByText(
        (_, node) =>
          node?.textContent ===
          "Esta ação removerá Safra 2023/2024 do sistema. Não é possível desfazer.",
      ),
    ).toBeTruthy();
  });
});

describe("HarvestsPage — layout mobile", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("em viewport mobile, renderiza cards (sem <table>) com as ações de editar/excluir acessíveis", async () => {
    await mockRole("ADMIN");
    await mockMobile(true);
    await mockHarvestsApi();

    await renderHarvestsPage();

    expect(screen.queryByRole("table")).toBeNull();
    expect(
      screen.getAllByRole("button", { name: "Editar safra" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: "Excluir safra" }).length,
    ).toBeGreaterThan(0);
  });

  it("em viewport mobile sem permissão de escrita, nenhuma ação aparece", async () => {
    await mockRole("FARMER");
    await mockMobile(true);
    await mockHarvestsApi();

    await renderHarvestsPage();

    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("button", { name: "Editar safra" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Excluir safra" })).toBeNull();
  });
});
