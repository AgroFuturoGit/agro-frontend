import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ProducerPlansPage } from "@/components/admin/production/producer-plans-page";
import { ApiError } from "@/lib/api";
import { readUserFromStorage, type AuthUser, type Role } from "@/lib/auth";
import { getCommunity, type Community } from "@/lib/communities";
import { getMyProducer, listProducers, type Producer } from "@/lib/producers";
import { listProductionPlans, type ProductionPlan } from "@/lib/production";
import type { Organization } from "@/lib/organizations";

const replace = vi.fn();
// Referência ESTÁVEL entre renders — ver comentário equivalente em
// `community-producers-page.test.tsx`.
const router = { replace };
vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

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

const ORGANIZATION: Organization = {
  id: "org-1",
  name: "Cooperativa Serra Azul",
  taxId: "12345678000199",
  type: "COOP",
};

const COMMUNITY: Community = {
  id: "community-1",
  name: "Comunidade Alto da Serra",
  organization: ORGANIZATION,
};

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
  community: { id: "community-1", name: "Comunidade Alto da Serra", organization: ORGANIZATION },
};

const OTHER_PRODUCER: Producer = {
  ...MY_PRODUCER,
  id: "producer-2",
  user: { ...MY_PRODUCER.user!, id: "user-2", fullName: "Bruno do Vale" },
};

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

function renderPage(producerId = "producer-1") {
  return render(
    <ProducerPlansPage
      orgId="org-1"
      communityId="community-1"
      producerId={producerId}
    />,
  );
}

beforeEach(() => {
  vi.mocked(readUserFromStorage).mockReturnValue(null);
  vi.mocked(getMyProducer).mockResolvedValue(MY_PRODUCER);
  vi.mocked(getCommunity).mockResolvedValue(COMMUNITY);
  vi.mocked(listProducers).mockResolvedValue([MY_PRODUCER, OTHER_PRODUCER]);
  vi.mocked(listProductionPlans).mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ProducerPlansPage — producerId escopado pela rota (sem seletor)", () => {
  it("ADMIN: lista os planos do produtor da URL diretamente", async () => {
    loginAs("ADMIN");
    vi.mocked(listProductionPlans).mockResolvedValue(PLANS);

    renderPage();

    expect(await screen.findByText("Milho — BRS 1010")).toBeTruthy();
    expect(listProductionPlans).toHaveBeenCalledExactlyOnceWith("producer-1");
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("PRODUCER: acessando o próprio producerId, vê os planos normalmente", async () => {
    loginAs("PRODUCER");
    vi.mocked(listProductionPlans).mockResolvedValue(PLANS);

    renderPage("producer-1");

    expect(await screen.findByText("Milho — BRS 1010")).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it("PRODUCER: acessando producerId de outro produtor é bloqueado e redireciona (guarda de ownership)", async () => {
    loginAs("PRODUCER");
    vi.mocked(listProductionPlans).mockResolvedValue(PLANS);

    renderPage("producer-2");

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/admin/organizacoes"),
    );
    expect(listProductionPlans).not.toHaveBeenCalled();
    expect(screen.queryByText("Milho — BRS 1010")).toBeNull();
  });
});

/**
 * Mesma proteção de M12 (`qa-report.md`, `production-plans-page.test.tsx`
 * original): a coluna "Ações" só existe com pelo menos uma linha em tela.
 */
describe("ProducerPlansPage — gating das ações de escrita por role", () => {
  it("MANAGER: com plano em tela, NENHUMA ação de escrita renderiza", async () => {
    loginAs("MANAGER");
    vi.mocked(listProductionPlans).mockResolvedValue(PLANS);

    renderPage();

    expect(await screen.findByText("Milho — BRS 1010")).toBeTruthy();
    expect(screen.queryByRole("columnheader", { name: "Ações" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Editar plano" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Excluir plano" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Novo plano/i })).toBeNull();
  });

  // canWrite = PRODUCER/ADMIN/TECHNICIAN; canDelete = ADMIN/TECHNICIAN
  // apenas (@PreAuthorize real do ProductionController). ADMIN e TECHNICIAN
  // têm as 3 ações (Novo plano, Editar, Excluir); PRODUCER edita mas nunca
  // exclui.
  it.each(["ADMIN", "TECHNICIAN"] as const)(
    "%s: com plano em tela, vê todas as ações de escrita, incluindo excluir",
    async (role) => {
      loginAs(role);
      vi.mocked(listProductionPlans).mockResolvedValue(PLANS);

      renderPage();

      expect(await screen.findByText("Milho — BRS 1010")).toBeTruthy();
      expect(screen.getByRole("columnheader", { name: "Ações" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Editar plano" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Excluir plano" })).toBeTruthy();
      expect(screen.getByRole("button", { name: /Novo plano/i })).toBeTruthy();
    },
  );

  it("PRODUCER: com plano em tela, vê Novo/Editar plano, mas NÃO vê Excluir (delete é só ADMIN/TECHNICIAN)", async () => {
    loginAs("PRODUCER");
    vi.mocked(listProductionPlans).mockResolvedValue(PLANS);

    renderPage("producer-1");

    expect(await screen.findByText("Milho — BRS 1010")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Ações" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Editar plano" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Novo plano/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Excluir plano" })).toBeNull();
  });

  it("MANAGER: sem planos, vê o estado vazio SEM atalho de criação", async () => {
    loginAs("MANAGER");

    renderPage();

    expect(
      await screen.findByText("Nenhum plano de produção cadastrado ainda."),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Criar primeiro plano" }),
    ).toBeNull();
  });

  it("role desconhecida: nenhuma afordância de escrita renderiza (falha fechado)", async () => {
    renderPage();

    await waitFor(() =>
      expect(
        screen.queryByText("Nenhum plano de produção cadastrado ainda."),
      ).toBeTruthy(),
    );
    expect(screen.queryByRole("columnheader", { name: "Ações" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Novo plano/i })).toBeNull();
  });
});

describe("ProducerPlansPage — erro de API e recuperação", () => {
  it("erro ao carregar os planos exibe o alerta e 'Tentar novamente' refaz a busca", async () => {
    loginAs("ADMIN");
    vi.mocked(listProductionPlans)
      .mockRejectedValueOnce(new ApiError(503, "Serviço indisponível", {}))
      .mockResolvedValue(PLANS);

    renderPage();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Serviço indisponível");

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByText("Milho — BRS 1010")).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });
});
