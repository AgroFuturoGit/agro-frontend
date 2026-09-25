import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import { PlanDetail } from "@/components/admin/production/plan-detail";
import { useIsMobile } from "@/hooks/use-mobile";
import { ApiError } from "@/lib/api";
import { readUserFromStorage, type AuthUser, type Role } from "@/lib/auth";
import { getCommunity } from "@/lib/communities";
import { getMyProducer, listProducers } from "@/lib/producers";
import {
  deleteProductionExecution,
  getProductionComparison,
  getProductionPlan,
  listProductionExecutions,
  type ProductionComparison,
  type ProductionExecution,
  type ProductionPlan,
} from "@/lib/production";

// Nenhum acesso de rede real: os 3 GET principais da tela são mockados, então
// `apiRequest` nunca é alcançado (mesmo padrão de
// `producer-plans-page.test.tsx`). O resto do módulo é preservado via
// `importActual` porque a tela e os diálogos usam outros exports
// (`formatNumber`, `formatPlanDate`, escrita de apontamento, tipos).
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: vi.fn(() => false) }));

vi.mock("@/lib/production", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/production")>(
      "@/lib/production",
    );
  return {
    ...actual,
    getProductionPlan: vi.fn(),
    getProductionComparison: vi.fn(),
    listProductionExecutions: vi.fn(),
    deleteProductionExecution: vi.fn(),
  };
});

vi.mock("@/lib/auth", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return { ...actual, readUserFromStorage: vi.fn() };
});

// Resolução do breadcrumb (best-effort, ver `plan-detail.tsx`) — mockados
// para não depender de rede real e não afetar as asserções de escrita/
// leitura dos 3 GET principais.
vi.mock("@/lib/communities", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/communities")>(
      "@/lib/communities",
    );
  return { ...actual, getCommunity: vi.fn() };
});

vi.mock("@/lib/producers", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/producers")>(
      "@/lib/producers",
    );
  return { ...actual, getMyProducer: vi.fn(), listProducers: vi.fn() };
});

const PLAN: ProductionPlan = {
  id: "plan-1",
  crop: { id: "crop-1", name: "Milho", variety: "BRS 1010" },
  harvest: {
    id: "harvest-1",
    label: "Safra 2025/2026",
    startDate: null,
    endDate: null,
  },
  plantedArea: 12.5,
  expectedYield: 40,
  plannedPlantingDate: "2026-01-15",
  createdAt: null,
};

const COMPARISON: ProductionComparison = {
  productionPlanId: "plan-1",
  expectedYield: 40,
  totalActualYield: 18,
  difference: -22,
  percentageRealized: 45,
};

const EXECUTIONS: ProductionExecution[] = [
  {
    id: "execution-1",
    productionPlanId: "plan-1",
    actualYield: 18,
    harvestDate: "2026-05-10",
    createdAt: null,
  },
];

function loginAs(role: Role) {
  const user: AuthUser = {
    id: "user-1",
    fullName: "José da Silva",
    email: "jose@agro.com",
    cpf: "12345678901",
    role,
    dateOfBirth: null,
  };
  vi.mocked(readUserFromStorage).mockReturnValue(user);
}

/** Wrapper com os 3 novos parâmetros de rota — `planId` continua o único
 * argumento variável nos testes existentes. */
function renderPlanDetail(planId = "plan-1") {
  return render(
    <PlanDetail
      orgId="org-1"
      communityId="community-1"
      producerId="producer-1"
      planId={planId}
    />,
  );
}

/**
 * Prova que a LEITURA continua funcionando para a role sob teste — os 3 GET
 * desta tela foram abertos às 4 roles em F03. Sem uma linha de apontamento em
 * tela, as asserções de ausência abaixo passariam por vazio (lição
 * `role-gating-must-cover-all-write-affordances`).
 */
async function expectPlanIsReadable() {
  // O breadcrumb também mostra "Milho — BRS 1010" (último nível, plano) —
  // escopar ao heading evita ambiguidade entre os dois elementos.
  expect(
    await screen.findByRole("heading", { name: "Milho — BRS 1010" }),
  ).toBeTruthy();
  expect(screen.getByText(/Safra 2025\/2026/)).toBeTruthy();
  expect(screen.getByText("10/05/2026")).toBeTruthy();
  expect(screen.getByText("18")).toBeTruthy();
}

/** As 4 ações de escrita da tela + a coluna que hospeda duas delas. */
function queryWriteAffordances() {
  return {
    novoApontamento: screen.queryByRole("button", {
      name: /Novo apontamento/i,
    }),
    primeiraColheita: screen.queryByRole("button", {
      name: /Registrar primeira colheita/i,
    }),
    editar: screen.queryByRole("button", { name: "Editar apontamento" }),
    excluir: screen.queryByRole("button", { name: "Excluir apontamento" }),
    colunaAcoes: screen.queryByRole("columnheader", { name: "Ações" }),
  };
}

beforeEach(() => {
  vi.mocked(readUserFromStorage).mockReturnValue(null);
  vi.mocked(getProductionPlan).mockResolvedValue(PLAN);
  vi.mocked(getProductionComparison).mockResolvedValue(COMPARISON);
  vi.mocked(listProductionExecutions).mockResolvedValue(EXECUTIONS);
  vi.mocked(deleteProductionExecution).mockResolvedValue(undefined);
  // Resolução do breadcrumb: best-effort, não faz parte das asserções deste
  // arquivo — qualquer resultado plausível serve.
  vi.mocked(getCommunity).mockRejectedValue(new Error("not relevant here"));
  vi.mocked(listProducers).mockRejectedValue(new Error("not relevant here"));
  vi.mocked(getMyProducer).mockRejectedValue(new Error("not relevant here"));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/**
 * Gap C2 do `qa-report.md`: esta tela tinha ZERO teste e passou a ser
 * alcançável por MANAGER/TECHNICIAN/ADMIN em F03 (os 3 GET foram abertos às 4
 * roles). POST/PUT/DELETE de apontamento continuam `hasRole('FARMER')` no
 * backend, então toda afordância de escrita visível para as demais roles é
 * 403 garantido.
 */
describe("PlanDetail — gating das ações de escrita por role", () => {
  it("MANAGER: lê o plano e o apontamento, mas NENHUMA ação de escrita renderiza", async () => {
    loginAs("MANAGER");

    renderPlanDetail();

    await expectPlanIsReadable();

    const affordances = queryWriteAffordances();
    expect(affordances.novoApontamento).toBeNull();
    expect(affordances.primeiraColheita).toBeNull();
    expect(affordances.editar).toBeNull();
    expect(affordances.excluir).toBeNull();
    expect(affordances.colunaAcoes).toBeNull();
  });

  it("MANAGER: sem apontamentos, vê o estado vazio SEM o atalho de criação", async () => {
    loginAs("MANAGER");
    vi.mocked(listProductionExecutions).mockResolvedValue([]);

    renderPlanDetail();

    expect(
      await screen.findByText("Nenhum apontamento registrado ainda."),
    ).toBeTruthy();
    expect(queryWriteAffordances().primeiraColheita).toBeNull();
    expect(queryWriteAffordances().novoApontamento).toBeNull();
  });

  // canWrite = canDelete = FARMER/ADMIN/TECHNICIAN, espelhando o
  // `@PreAuthorize` real de `DELETE /production-executions/{executionId}`
  // (`hasAnyRole('ADMIN', 'TECHNICIAN', 'FARMER')`). O FARMER entrou nesta
  // lista depois de o ownership ser medido contra o backend real (403 no
  // apontamento de outro agricultor, 204 no próprio) — ver o comentário em
  // `plan-detail.tsx`.
  it.each(["ADMIN", "TECHNICIAN", "FARMER"] as const)(
    "%s: vê as 4 ações de escrita, incluindo excluir (create/update/delete liberados)",
    async (role) => {
      loginAs(role);

      renderPlanDetail();

      await expectPlanIsReadable();

      expect(
        screen.getByRole("button", { name: /Novo apontamento/i }),
      ).toBeTruthy();
      expect(
        screen.getByRole("button", { name: "Editar apontamento" }),
      ).toBeTruthy();
      expect(
        screen.getByRole("button", { name: "Excluir apontamento" }),
      ).toBeTruthy();
      expect(screen.getByRole("columnheader", { name: "Ações" })).toBeTruthy();
    },
  );

  it("FARMER sem apontamentos: vê 'Registrar primeira colheita'", async () => {
    loginAs("FARMER");
    vi.mocked(listProductionExecutions).mockResolvedValue([]);

    renderPlanDetail();

    expect(
      await screen.findByRole("button", { name: /Registrar primeira colheita/i }),
    ).toBeTruthy();
    expect(
      screen.getByText("Nenhum apontamento registrado ainda."),
    ).toBeTruthy();
  });

  it("role desconhecida: nenhuma ação de escrita renderiza (RN4, falha fechado)", async () => {
    // `readUserFromStorage()` devolve null (default do beforeEach): a leitura
    // desta tela não depende da role, então o conteúdo carrega normalmente
    // enquanto a role é resolvida — a escrita, não.
    renderPlanDetail();

    await expectPlanIsReadable();

    const affordances = queryWriteAffordances();
    expect(affordances.novoApontamento).toBeNull();
    expect(affordances.primeiraColheita).toBeNull();
    expect(affordances.editar).toBeNull();
    expect(affordances.excluir).toBeNull();
    expect(affordances.colunaAcoes).toBeNull();
  });
});

/**
 * Estados do `DeleteExecutionDialog` exercitados pela role recém-liberada.
 * `EXECUTIONS` tem uma linha de propósito: a ação de linha só renderiza se
 * houver linha (lição `role-gating-must-cover-all-write-affordances`,
 * regra 4).
 */
describe("PlanDetail — exclusão de apontamento pelo FARMER", () => {
  async function openDeleteDialog() {
    loginAs("FARMER");

    renderPlanDetail();

    await expectPlanIsReadable();
    fireEvent.click(
      screen.getByRole("button", { name: "Excluir apontamento" }),
    );
    expect(
      await screen.findByRole("alertdialog", { name: "Excluir apontamento" }),
    ).toBeTruthy();
  }

  it("confirmação pendente: o dialog abre e NADA é excluído antes do confirmar", async () => {
    await openDeleteDialog();

    expect(deleteProductionExecution).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Excluir" })).toBeTruthy();
    expect(vi.mocked(listProductionExecutions).mock.calls.length).toBe(1);
  });

  it("sucesso: chama a API, fecha o dialog e recarrega os 3 GET da tela", async () => {
    await openDeleteDialog();

    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));

    await waitFor(() =>
      expect(deleteProductionExecution).toHaveBeenCalledWith("execution-1"),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("alertdialog", { name: "Excluir apontamento" }),
      ).toBeNull(),
    );
    expect(vi.mocked(listProductionExecutions).mock.calls.length).toBe(2);
    expect(vi.mocked(getProductionComparison).mock.calls.length).toBe(2);
  });

  it("erro da API: mostra o alerta, mantém o dialog aberto e não recarrega", async () => {
    await openDeleteDialog();
    vi.mocked(deleteProductionExecution).mockRejectedValue(
      new ApiError(403, "Você não pode excluir este apontamento.", null),
    );

    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));

    expect(
      await screen.findByText("Você não pode excluir este apontamento."),
    ).toBeTruthy();
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(
      screen.getByRole("alertdialog", { name: "Excluir apontamento" }),
    ).toBeTruthy();
    expect(vi.mocked(listProductionExecutions).mock.calls.length).toBe(1);
  });
});

describe("PlanDetail — erro de API e recuperação", () => {
  it("erro no carregamento exibe role=alert com a mensagem do ApiError e nenhuma escrita", async () => {
    loginAs("MANAGER");
    vi.mocked(getProductionPlan).mockRejectedValue(
      new ApiError(403, "Acesso negado", {}),
    );

    renderPlanDetail();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Acesso negado");
    // Sem conteúdo parcial: nada do plano é exibido junto do erro.
    expect(screen.queryByText("Milho — BRS 1010")).toBeNull();
    expect(queryWriteAffordances().novoApontamento).toBeNull();
  });

  it("'Tentar novamente' refaz os 3 GET e a tela se recupera", async () => {
    loginAs("FARMER");
    vi.mocked(getProductionPlan)
      .mockRejectedValueOnce(new ApiError(503, "Serviço indisponível", {}))
      .mockResolvedValue(PLAN);

    renderPlanDetail();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Serviço indisponível");

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(
      await screen.findByRole("heading", { name: "Milho — BRS 1010" }),
    ).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(getProductionPlan).toHaveBeenCalledTimes(2);
    expect(getProductionComparison).toHaveBeenCalledTimes(2);
    expect(listProductionExecutions).toHaveBeenCalledTimes(2);
  });

  it("erro não-ApiError cai na mensagem genérica da tela", async () => {
    loginAs("FARMER");
    vi.mocked(listProductionExecutions).mockRejectedValue(new Error("boom"));

    renderPlanDetail();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(
      "Não foi possível carregar o plano de produção.",
    );
  });
});

describe("PlanDetail — tabela de apontamentos", () => {
  afterEach(() => {
    vi.mocked(useIsMobile).mockReturnValue(false);
  });

  it("lista os apontamentos do mais recente para o mais antigo", async () => {
    loginAs("FARMER");
    vi.mocked(listProductionExecutions).mockResolvedValue([
      { ...EXECUTIONS[0], id: "execution-a", harvestDate: "2026-04-02", actualYield: 5 },
      { ...EXECUTIONS[0], id: "execution-b", harvestDate: "2026-06-20", actualYield: 7 },
      EXECUTIONS[0],
    ]);

    renderPlanDetail();

    await screen.findByText("20/06/2026");
    const dates = screen
      .getAllByRole("row")
      .slice(1)
      .map((row) => row.querySelectorAll("td")[0]?.textContent);
    expect(dates).toEqual(["20/06/2026", "10/05/2026", "02/04/2026"]);
  });

  it("sem apontamentos, 'Registrar primeira colheita' abre o drawer", async () => {
    loginAs("FARMER");
    vi.mocked(listProductionExecutions).mockResolvedValue([]);

    renderPlanDetail();

    fireEvent.click(
      await screen.findByRole("button", { name: "Registrar primeira colheita" }),
    );

    const drawer = await screen.findByRole("dialog");
    expect(drawer).toHaveAttribute("data-slot", "sheet-content");
    expect(drawer.textContent).toContain("Novo apontamento");
  });

  it("em viewport mobile renderiza cards, sem <table>", async () => {
    loginAs("FARMER");
    vi.mocked(useIsMobile).mockReturnValue(true);

    renderPlanDetail();

    expect(await screen.findByText("10/05/2026")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByRole("button", { name: "Editar" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Excluir apontamento" }),
    ).toBeTruthy();
  });
});
