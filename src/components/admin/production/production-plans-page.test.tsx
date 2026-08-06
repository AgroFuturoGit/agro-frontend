import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import { ProductionPlansPage } from "@/components/admin/production/production-plans-page";
import { readUserFromStorage, type AuthUser, type Role } from "@/lib/auth";
import { getMyProducer, listProducers, type Producer } from "@/lib/producers";
import { listProductionPlans, type ProductionPlan } from "@/lib/production";

// Nenhum acesso de rede real: os clientes de domínio são mockados por
// completo, então `apiRequest` nunca chega a ser alcançado (mesmo padrão de
// `producer-register-dialog.test.tsx`). O resto de cada módulo é preservado
// via `importActual` porque a página e seus diálogos usam outros exports
// (`formatNumber`, `formatPlanDate`, `deleteProductionPlan`, tipos).
vi.mock("@/lib/producers", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/producers")>("@/lib/producers");
  return { ...actual, getMyProducer: vi.fn(), listProducers: vi.fn() };
});

vi.mock("@/lib/production", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/production")>(
      "@/lib/production",
    );
  return { ...actual, listProductionPlans: vi.fn() };
});

vi.mock("@/lib/auth", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return { ...actual, readUserFromStorage: vi.fn() };
});

const MY_PRODUCER: Producer = {
  id: "producer-1",
  aliasName: "Zé",
  isCompliant: true,
  user: {
    id: "user-1",
    fullName: "José da Silva",
    email: "jose@agro.com",
    cpf: "12345678901",
  },
  community: { id: "community-1", name: "Comunidade Alfa" },
};

const OTHER_PRODUCER: Producer = {
  id: "producer-2",
  aliasName: "Apelido Beta",
  isCompliant: true,
  // Sem usuário vinculado: o rótulo cai no `aliasName`.
  user: null,
  community: { id: "community-1", name: "Comunidade Alfa" },
};

const PRODUCERS: Producer[] = [MY_PRODUCER, OTHER_PRODUCER];

const PLANS: ProductionPlan[] = [
  {
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

/** Janela real de tempo para provar a AUSÊNCIA de chamada (RN4). */
function settle(ms = 30) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// O `Select` do base-ui é portalizado e fica desabilitado enquanto a lista de
// produtores carrega — esperamos ele habilitar antes de abrir pelo teclado.
async function openProducerSelect() {
  const trigger = await screen.findByLabelText("Produtor");
  await waitFor(() => {
    expect(trigger.hasAttribute("disabled")).toBe(false);
    expect(trigger.getAttribute("data-disabled")).toBeNull();
  });
  trigger.focus();
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  fireEvent.keyUp(trigger, { key: "ArrowDown" });
  return trigger;
}

/**
 * Contrato compartilhado por MANAGER, TECHNICIAN e ADMIN (RN6): seletor de
 * produtor em tela, lista de produtores carregada e NENHUMA busca de planos
 * antes da escolha.
 */
async function expectProducerSelectFlow(role: Role) {
  loginAs(role);
  render(<ProductionPlansPage />);

  await waitFor(() => expect(listProducers).toHaveBeenCalledTimes(1));
  expect(await screen.findByLabelText("Produtor")).toBeTruthy();
  expect(
    screen.getByText("Selecione um produtor para ver os planos de produção"),
  ).toBeTruthy();

  // RN6: nada de planos antes de escolher o produtor.
  expect(listProductionPlans).not.toHaveBeenCalled();
  // `/producers/me` é exclusivo do PRODUCER.
  expect(getMyProducer).not.toHaveBeenCalled();
  // Criar plano continua sendo hasRole('PRODUCER') no backend.
  expect(screen.queryByRole("button", { name: /Novo plano/i })).toBeNull();
}

beforeEach(() => {
  vi.mocked(readUserFromStorage).mockReturnValue(null);
  vi.mocked(listProducers).mockResolvedValue(PRODUCERS);
  vi.mocked(getMyProducer).mockResolvedValue(MY_PRODUCER);
  vi.mocked(listProductionPlans).mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ProductionPlansPage — ramificação por role (spec.md §3.4)", () => {
  it("PRODUCER: busca o próprio produtor, lista os planos e NÃO vê seletor (RN5)", async () => {
    loginAs("PRODUCER");
    vi.mocked(listProductionPlans).mockResolvedValue(PLANS);

    render(<ProductionPlansPage />);

    // Sequência de chamadas do caminho que já roda em produção:
    // getMyProducer() -> listProductionPlans(producer.id).
    await waitFor(() => expect(getMyProducer).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(listProductionPlans).toHaveBeenCalledExactlyOnceWith("producer-1"),
    );
    expect(
      vi.mocked(getMyProducer).mock.invocationCallOrder[0],
    ).toBeLessThan(
      vi.mocked(listProductionPlans).mock.invocationCallOrder[0],
    );

    // Os planos do produtor aparecem em tela.
    expect(await screen.findByText("Milho — BRS 1010")).toBeTruthy();
    expect(screen.getByText("Safra 2025/2026")).toBeTruthy();

    // Nenhum seletor de produtor para o PRODUCER (proibição explícita da fase).
    expect(screen.queryByLabelText("Produtor")).toBeNull();
    expect(
      screen.queryByText("Selecione um produtor para ver os planos de produção"),
    ).toBeNull();
    expect(listProducers).not.toHaveBeenCalled();
  });

  it("MANAGER: vê o seletor, carrega os produtores e não busca planos ainda (RN6)", async () => {
    await expectProducerSelectFlow("MANAGER");
  });

  it("TECHNICIAN: mesmo comportamento de seletor do MANAGER (RN6)", async () => {
    await expectProducerSelectFlow("TECHNICIAN");
  });

  it("ADMIN: também cai no caminho do seletor (decisão da task 03-01)", async () => {
    await expectProducerSelectFlow("ADMIN");
  });

  it("selecionar um produtor carrega os planos daquele produtor", async () => {
    loginAs("MANAGER");
    vi.mocked(listProductionPlans).mockResolvedValue(PLANS);

    render(<ProductionPlansPage />);
    await waitFor(() => expect(listProducers).toHaveBeenCalledTimes(1));

    await openProducerSelect();

    // Rótulos: `user.fullName` quando existe, `aliasName` como fallback.
    const first = await screen.findByRole("option", { name: "José da Silva" });
    expect(screen.getByRole("option", { name: "Apelido Beta" })).toBeTruthy();

    // O `Select` do base-ui só confirma o item destacado, então navegamos até
    // o segundo produtor pelo teclado antes de confirmar com Enter.
    fireEvent.keyDown(first, { key: "ArrowDown" });
    fireEvent.keyUp(first, { key: "ArrowDown" });
    const highlighted = document.activeElement as HTMLElement;
    expect(highlighted.textContent).toContain("Apelido Beta");
    fireEvent.keyDown(highlighted, { key: "Enter" });
    fireEvent.keyUp(highlighted, { key: "Enter" });

    // O id enviado é o do produtor ESCOLHIDO, não o primeiro da lista.
    await waitFor(() =>
      expect(listProductionPlans).toHaveBeenCalledExactlyOnceWith("producer-2"),
    );
    expect(await screen.findByText("Milho — BRS 1010")).toBeTruthy();
    // Sem refetch redundante da lista de produtores.
    expect(listProducers).toHaveBeenCalledTimes(1);
    expect(getMyProducer).not.toHaveBeenCalled();
  });

  it("role indefinida: nenhuma requisição é disparada no mount (RN4)", async () => {
    // `readUserFromStorage()` devolve null (default do beforeEach).
    render(<ProductionPlansPage />);

    await settle();

    expect(readUserFromStorage).toHaveBeenCalled();
    expect(getMyProducer).not.toHaveBeenCalled();
    expect(listProducers).not.toHaveBeenCalled();
    expect(listProductionPlans).not.toHaveBeenCalled();
    // A tela permanece em carregamento até a role ser conhecida.
    expect(screen.queryByLabelText("Produtor")).toBeNull();
    expect(
      screen.queryByText("Nenhum plano de produção cadastrado ainda."),
    ).toBeNull();
  });
});
