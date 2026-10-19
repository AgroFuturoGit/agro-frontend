import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * ⚠️ ESCOPO DESTE ARQUIVO — LEIA ANTES DE CONFIAR NO VERDE.
 *
 * A sessão aqui é FABRICADA (cookies `agro_token`/`agro_role` +
 * `localStorage["agro_user"]`, decisão D5 de F01) e a API é INTEIRAMENTE
 * MOCKADA via `page.route()`. Nenhuma requisição chega ao backend Spring.
 *
 * Consequência: estes cenários provam o comportamento da UI (role → seletor
 * correto → requisição correta → planos em tela), **não** a integração real.
 * Em F01 a fase inteira fechou verde exatamente assim enquanto a tela
 * quebrava de verdade para o MANAGER contra o backend real
 * (memória `f01-frontend-only-not-e2e-verified`).
 *
 * Agrava o caso aqui: `GET /farmers` (TECHNICIAN) e
 * `GET /farmers/{id}/production-plans` (MANAGER) dependem das correções
 * da branch `fix/rbac-alinhamento-frontend` do `agro-backend` (risco R10).
 * Contra o backend atual essas chamadas ainda respondem 403 — o mock passa
 * por cima disso.
 *
 * Portanto: **estes testes NÃO substituem a validação ao vivo da task
 * 05-02**, que exige backend rodando e login real por role. Verde aqui é
 * condição necessária, nunca suficiente.
 */

const AUTH_TOKEN_COOKIE = "agro_token";
const AUTH_ROLE_COOKIE = "agro_role";
// Chave usada por `persistSession`/`readUserFromStorage` em `src/lib/auth.ts`.
const AUTH_USER_STORAGE_KEY = "agro_user";

type FakeUser = {
  id: string;
  fullName: string;
  email: string;
  cpf: string;
  role: string;
  dateOfBirth: string | null;
};

/**
 * Fabrica a sessão via cookies + localStorage, sem login real pelo
 * formulário. Cópia deliberada do helper de `e2e/hierarchy.spec.ts`: os
 * specs existentes não podem ser alterados para acomodar cenários novos.
 */
async function loginAs(page: Page, role: string, user?: FakeUser) {
  await page.context().addCookies([
    {
      name: AUTH_TOKEN_COOKIE,
      value: "e2e-fake-token",
      url: "http://localhost:3000",
    },
    {
      name: AUTH_ROLE_COOKIE,
      value: role,
      url: "http://localhost:3000",
    },
  ]);

  if (user) {
    await page.addInitScript(
      ({ key, value }) => {
        window.localStorage.setItem(key, value);
      },
      { key: AUTH_USER_STORAGE_KEY, value: JSON.stringify(user) },
    );
  }
}

const ORGANIZATION = {
  id: "aaaaaaaa-1111-0000-0000-000000000001",
  name: "Cooperativa Serra Azul",
  taxId: "12345678000199",
  type: "COOP",
};

const COMMUNITY_A = {
  id: "bbbbbbbb-1111-0000-0000-00000000000a",
  name: "Comunidade Alto da Serra",
  organization: ORGANIZATION,
};

const COMMUNITY_B = {
  id: "bbbbbbbb-1111-0000-0000-00000000000b",
  name: "Comunidade Vale do Sol",
  organization: ORGANIZATION,
};

const PRODUCER_ANA = {
  id: "eeeeeeee-1111-0000-0000-00000000000a",
  fullName: "Ana Serrana",
  isCompliant: true,
  user: {
    id: "ffffffff-1111-0000-0000-00000000000a",
    fullName: "Ana Serrana",
    email: "ana@example.com",
    cpf: "12345678909",
  },
  community: COMMUNITY_A,
};

const PRODUCER_BRUNO = {
  id: "eeeeeeee-1111-0000-0000-00000000000b",
  fullName: "Bruno do Vale",
  isCompliant: false,
  user: {
    id: "ffffffff-1111-0000-0000-00000000000b",
    fullName: "Bruno do Vale",
    email: "bruno@example.com",
    cpf: "98765432100",
  },
  community: COMMUNITY_B,
};

function planFor(producerId: string, cropName: string) {
  return {
    id: `plan-${producerId}`,
    crop: {
      id: "0a0a0a0a-0000-0000-0000-000000000001",
      name: cropName,
      variety: "Catuaí",
      isPriority: false,
      cycleDays: 240,
      expectedProductivity: 1200,
      harvestType: "SINGLE",
      unit: "SACK",
      unitWeightKg: 60,
    },
    harvest: {
      id: "0b0b0b0b-0000-0000-0000-000000000001",
      label: "Safra 2026",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
    },
    plantedArea: 12.5,
    status: "ACTIVE",
    expectedHarvestStart: "2026-05-01",
    expectedHarvestEnd: "2026-06-30",
    expectedProductivity: 1200,
    plannedPlantingDate: "2026-09-01",
    createdAt: "2026-08-01T10:00:00Z",
  };
}

test.describe("Planos de produção — navegação em cascata por role", () => {
  test("TECHNICIAN acessa a URL de um produtor diretamente (sem seletor) e vê os planos dele", async ({
    page,
  }) => {
    const technicianUser: FakeUser = {
      id: "cccccccc-1111-0000-0000-000000000001",
      fullName: "Tereza Técnica",
      email: "tereza.tech@example.com",
      cpf: "55566677788",
      role: "TECHNICIAN",
      dateOfBirth: "1992-07-11",
    };

    await loginAs(page, "TECHNICIAN", technicianUser);

    await page.route(`**/communities/${COMMUNITY_A.id}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(COMMUNITY_A),
      });
    });

    await page.route("**/farmers*", async (route) => {
      if (route.request().method() !== "GET") {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([PRODUCER_ANA, PRODUCER_BRUNO]),
      });
    });

    // Rota mais específica registrada por último = maior prioridade.
    const planRequests: string[] = [];
    await page.route(
      "**/farmers/*/production-plans*",
      async (route) => {
        const request = route.request();
        if (request.method() !== "GET") {
          await route.fallback();
          return;
        }
        planRequests.push(request.url());
        const body = request.url().includes(PRODUCER_ANA.id)
          ? [planFor(PRODUCER_ANA.id, "Café")]
          : [];
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(body),
        });
      },
    );

    // TECHNICIAN chega ao produtor pelo drill-down (Organizações → org →
    // comunidade → produtor); aqui simulamos já ter navegado até lá.
    await page.goto(
      `/admin/organizacoes/${ORGANIZATION.id}/comunidades/${COMMUNITY_A.id}/produtores/${PRODUCER_ANA.id}`,
    );

    // "Novo plano" é hasRole('FARMER', 'ADMIN', 'TECHNICIAN') no backend —
    // TECHNICIAN escreve, então o botão aparece (não-regressão RN da
    // migração). O delete tem exatamente as mesmas 3 roles.
    await expect(page.getByRole("cell", { name: /Café — Catuaí/ })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Safra 2026" })).toBeVisible();

    // Sem seletor de produtor — o escopo vem inteiramente da URL.
    await expect(
      page.getByRole("combobox", { name: /agricultor|produtor/i }),
    ).toHaveCount(0);

    expect(planRequests).toHaveLength(1);
    expect(planRequests[0]).toContain(
      `/farmers/${PRODUCER_ANA.id}/production-plans`,
    );
  });

  test("FARMER cai direto nos próprios planos ao acessar /admin/organizacoes, sem seletor de produtor", async ({
    page,
  }) => {
    const producerUser: FakeUser = {
      id: PRODUCER_ANA.user.id,
      fullName: PRODUCER_ANA.user.fullName,
      email: PRODUCER_ANA.user.email,
      cpf: PRODUCER_ANA.user.cpf,
      role: "FARMER",
      dateOfBirth: "1990-04-02",
    };

    await loginAs(page, "FARMER", producerUser);

    // Rede de segurança contra regressão: o FARMER nunca deve listar
    // produtores nem organizações/comunidades — o caminho dele é inteiro via
    // `GET /farmers/me` (que já traz comunidade+organização aninhadas).
    const listProducersRequests: string[] = [];
    await page.route("**/farmers*", async (route) => {
      if (route.request().method() !== "GET") {
        await route.fallback();
        return;
      }
      listProducersRequests.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([PRODUCER_ANA, PRODUCER_BRUNO]),
      });
    });

    await page.route("**/farmers/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(PRODUCER_ANA),
      });
    });

    await page.route(
      "**/farmers/*/production-plans*",
      async (route) => {
        if (route.request().method() !== "GET") {
          await route.fallback();
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([planFor(PRODUCER_ANA.id, "Milho")]),
        });
      },
    );

    // `/admin/organizacoes` é o único ponto de entrada — FARMER é
    // redirecionado automaticamente até o próprio produtor.
    await page.goto("/admin/organizacoes");

    await expect(page).toHaveURL(
      new RegExp(
        `/admin/organizacoes/${ORGANIZATION.id}/comunidades/${COMMUNITY_A.id}/produtores/${PRODUCER_ANA.id}$`,
      ),
    );

    await expect(
      page.getByRole("cell", { name: /Milho — Catuaí/ }),
    ).toBeVisible();

    // Proibição explícita: o FARMER não vê seletor de produtor nem lista
    // GET /farmers.
    await expect(
      page.getByRole("combobox", { name: /agricultor|produtor/i }),
    ).toHaveCount(0);
    expect(listProducersRequests).toHaveLength(0);

    // Sem regressão do fluxo do próprio produtor.
    await expect(
      page.getByRole("button", { name: "Novo plano" }),
    ).toBeVisible();

    // Breadcrumb mostra a hierarquia real do produtor, resolvida via
    // `GET /farmers/me` — não navegável para outro recurso (só o último
    // nível é não-clicável; os anteriores levam sempre aos próprios
    // recursos do produtor).
    const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(breadcrumb).toContainText(ORGANIZATION.name);
    await expect(breadcrumb).toContainText(COMMUNITY_A.name);
  });

  test("FARMER exclui o próprio plano: vê o botão, confirma no dialog e a lista recarrega sem ele", async ({
    page,
  }) => {
    const farmerUser: FakeUser = {
      id: PRODUCER_ANA.user.id,
      fullName: PRODUCER_ANA.user.fullName,
      email: PRODUCER_ANA.user.email,
      cpf: PRODUCER_ANA.user.cpf,
      role: "FARMER",
      dateOfBirth: "1990-04-02",
    };

    await loginAs(page, "FARMER", farmerUser);

    const PLAN = planFor(PRODUCER_ANA.id, "Milho");

    await page.route("**/farmers/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(PRODUCER_ANA),
      });
    });

    // A listagem começa NÃO-VAZIA de propósito: "Excluir plano" é ação de
    // linha e não renderiza sem linha — um mock vazio faria o teste passar
    // sem exercitar nada. Depois do DELETE, o mesmo endpoint passa a
    // devolver lista vazia, provando que a tela recarregou.
    let planDeleted = false;
    const planListRequests: string[] = [];
    await page.route("**/farmers/*/production-plans*", async (route) => {
      if (route.request().method() !== "GET") {
        await route.fallback();
        return;
      }
      planListRequests.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(planDeleted ? [] : [PLAN]),
      });
    });

    const deleteRequests: string[] = [];
    await page.route("**/production-plans/*", async (route) => {
      if (route.request().method() !== "DELETE") {
        await route.fallback();
        return;
      }
      deleteRequests.push(route.request().url());
      planDeleted = true;
      await route.fulfill({ status: 204, body: "" });
    });

    await page.goto(
      `/admin/organizacoes/${ORGANIZATION.id}/comunidades/${COMMUNITY_A.id}/produtores/${PRODUCER_ANA.id}`,
    );

    // Pré-condição: há uma linha em tela, logo a ação de linha é alcançável.
    await expect(
      page.getByRole("cell", { name: /Milho — Catuaí/ }),
    ).toBeVisible();

    const deleteButton = page.getByRole("button", { name: "Excluir plano" });
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();

    // Confirmação pendente: o dialog abre e nada foi excluído ainda.
    const dialog = page.getByRole("alertdialog", {
      name: "Excluir plano de produção",
    });
    await expect(dialog).toBeVisible();
    expect(deleteRequests).toHaveLength(0);

    await dialog.getByRole("button", { name: "Excluir", exact: true }).click();

    // Sucesso: o dialog fecha, o DELETE bateu no plano certo e a lista
    // recarregou — agora sem o plano.
    await expect(dialog).toBeHidden();
    expect(deleteRequests).toHaveLength(1);
    expect(deleteRequests[0]).toContain(`/production-plans/${PLAN.id}`);

    await expect(
      page.getByText("Nenhum plano de produção cadastrado ainda."),
    ).toBeVisible();
    await expect(page.getByRole("cell", { name: /Milho — Catuaí/ })).toHaveCount(
      0,
    );
    expect(planListRequests.length).toBeGreaterThanOrEqual(2);
  });
});

test.describe("Detalhe do plano — gráfico de colheita contínua (mockado)", () => {
  test("ADMIN vê o gráfico composto, alterna Semana/Mês e lê os valores exatos no tooltip", async ({
    page,
  }) => {
    await loginAs(page, "ADMIN", {
      id: "cccccccc-1111-0000-0000-000000000009",
      fullName: "Admin E2E",
      email: "admin@example.com",
      cpf: "11122233344",
      role: "ADMIN",
      dateOfBirth: null,
    });

    const plan = {
      ...planFor(PRODUCER_ANA.id, "Berinjela"),
      id: "plan-continuo-1",
      plantedArea: 1,
      expectedProductivity: 1800,
      expectedHarvestStart: "2026-05-04",
      expectedHarvestEnd: "2026-06-29",
    };
    plan.crop = { ...plan.crop, harvestType: "CONTINUOUS", unit: "KG" };

    const execution = (id: string, harvestedAt: string, kg: number, status: string) => ({
      id,
      productionPlanId: plan.id,
      quantity: kg,
      quantityKg: kg,
      harvestedAt,
      status,
      notes: null,
      rejectionReason: null,
      validatedBy: null,
      validatedAt: null,
      createdAt: "2026-05-06T10:00:00Z",
      updatedAt: "2026-05-06T10:00:00Z",
    });

    await page.route(`**/communities/${COMMUNITY_A.id}`, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(COMMUNITY_A) }),
    );
    await page.route("**/farmers*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([PRODUCER_ANA]) }),
    );
    await page.route(`**/production-plans/${plan.id}`, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(plan) }),
    );
    await page.route(`**/production-plans/${plan.id}/comparison`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          productionPlanId: plan.id,
          expectedYield: 1800,
          totalActualYield: 105,
          difference: -1695,
          percentageRealized: 5.83,
        }),
      }),
    );
    await page.route(`**/production-plans/${plan.id}/executions`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          execution("ex-1", "2026-05-05", 105, "VALIDATED"),
          execution("ex-2", "2026-06-02", 40, "PENDING"),
        ]),
      }),
    );

    await page.goto(
      `/admin/organizacoes/${ORGANIZATION.id}/comunidades/${COMMUNITY_A.id}/produtores/${PRODUCER_ANA.id}/planos/${plan.id}`,
    );

    const chart = page.getByRole("img", { name: /^Previsto 1\.800 kg/ });
    await expect(chart).toBeVisible();
    await expect(chart).toHaveAttribute("data-mode", "composite");
    await expect(chart).toHaveAttribute("data-granularity", "WEEK");

    // Tooltip da primeira semana (04/05/2026): valores exatos em kg.
    // O gráfico é um canvas: o tooltip abre ao passar o mouse sobre o 1º período.
    await chart.hover({ position: { x: 90, y: 150 } });
    const tooltip = page.getByTestId("harvest-chart-tooltip");
    await expect(tooltip).toContainText("Semana de 04/05/2026");
    await expect(tooltip).toContainText("Previsto: 221,05 kg");
    await expect(tooltip).toContainText("Validado: 105 kg");
    await expect(tooltip).toContainText("Pendente: 0 kg");

    await page.getByRole("button", { name: "Mês" }).click();
    await expect(page.getByRole("img", { name: /^Previsto 1\.800 kg/ })).toHaveAttribute(
      "data-granularity",
      "MONTH",
    );
    await expect(page.getByRole("button", { name: "Mês" })).toHaveAttribute("aria-pressed", "true");
  });
});

test.describe("Detalhe do plano — validação de apontamentos (mockado)", () => {
  const PLAN_ID = "plan-validacao-1";
  const PLAN_URL = `/admin/organizacoes/${ORGANIZATION.id}/comunidades/${COMMUNITY_A.id}/produtores/${PRODUCER_ANA.id}/planos/${PLAN_ID}`;

  type Exec = {
    id: string;
    productionPlanId: string;
    quantity: number;
    quantityKg: number;
    harvestedAt: string;
    status: string;
    notes: string | null;
    rejectionReason: string | null;
    validatedBy: string | null;
    validatedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };

  function makeExecution(id: string, harvestedAt: string, status = "PENDING"): Exec {
    return {
      id,
      productionPlanId: PLAN_ID,
      quantity: 10,
      quantityKg: 600,
      harvestedAt,
      status,
      notes: null,
      rejectionReason: null,
      validatedBy: null,
      validatedAt: null,
      createdAt: "2026-05-06T10:00:00Z",
      updatedAt: "2026-05-06T10:00:00Z",
    };
  }

  /** Mocks do plano; o estado das execuções vive no teste e é devolvido a cada GET. */
  async function mockPlan(page: Page, executions: Exec[]) {
    const plan = { ...planFor(PRODUCER_ANA.id, "Café"), id: PLAN_ID };
    await page.route(`**/communities/${COMMUNITY_A.id}`, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(COMMUNITY_A) }),
    );
    await page.route("**/farmers/me", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(PRODUCER_ANA) }),
    );
    await page.route("**/farmers?*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([PRODUCER_ANA]) }),
    );
    await page.route(`**/production-plans/${PLAN_ID}`, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(plan) }),
    );
    await page.route(`**/production-plans/${PLAN_ID}/comparison`, (route) => {
      const validatedKg = executions
        .filter((item) => item.status === "VALIDATED")
        .reduce((sum, item) => sum + item.quantityKg, 0);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          productionPlanId: PLAN_ID,
          expectedYield: 15000,
          totalActualYield: validatedKg,
          difference: validatedKg - 15000,
          percentageRealized: (validatedKg / 15000) * 100,
        }),
      });
    });
    await page.route(`**/production-plans/${PLAN_ID}/executions`, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(executions) }),
    );
  }

  test("TECHNICIAN valida um apontamento e rejeita outro sem motivo; o status muda na tela", async ({
    page,
  }) => {
    await loginAs(page, "TECHNICIAN", {
      id: "cccccccc-1111-0000-0000-000000000001",
      fullName: "Tereza Técnica",
      email: "tereza.tech@example.com",
      cpf: "55566677788",
      role: "TECHNICIAN",
      dateOfBirth: null,
    });

    const executions = [makeExecution("ex-a", "2026-05-10"), makeExecution("ex-b", "2026-05-11")];
    await mockPlan(page, executions);

    const bodies: Record<string, string | null> = {};
    for (const action of ["validate", "reject"] as const) {
      await page.route(`**/production-executions/*/${action}`, async (route) => {
        const id = route.request().url().split("/production-executions/")[1].split("/")[0];
        bodies[`${action}:${id}`] = route.request().postData();
        const target = executions.find((item) => item.id === id)!;
        target.status = action === "validate" ? "VALIDATED" : "REJECTED";
        target.validatedAt = "2026-05-12T09:00:00";
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(target) });
      });
    }

    await page.goto(PLAN_URL);

    // Linha de 10/05 (ex-a): validar com confirmação.
    await expect(page.getByRole("button", { name: "Validar apontamento" })).toHaveCount(2);
    await page.getByRole("button", { name: "Validar apontamento" }).first().click();
    const validateDialog = page.getByRole("alertdialog", { name: "Validar apontamento" });
    await expect(validateDialog).toBeVisible();
    expect(Object.keys(bodies)).toHaveLength(0);
    await validateDialog.getByRole("button", { name: "Validar", exact: true }).click();
    await expect(validateDialog).toBeHidden();
    expect(bodies["validate:ex-a"] ?? null).toBeNull();
    await expect(page.getByText("Validado", { exact: true })).toBeVisible();
    await expect(page.getByText("Decidido em 12/05/2026")).toBeVisible();

    // Restou só uma linha pendente: rejeitar com motivo vazio.
    await expect(page.getByRole("button", { name: "Rejeitar apontamento" })).toHaveCount(1);
    await page.getByRole("button", { name: "Rejeitar apontamento" }).click();
    const rejectDialog = page.getByRole("alertdialog", { name: "Rejeitar apontamento" });
    await rejectDialog.getByRole("button", { name: "Rejeitar", exact: true }).click();
    await expect(rejectDialog).toBeHidden();
    expect(JSON.parse(bodies["reject:ex-b"] ?? "{}")).not.toHaveProperty("reason");
    await expect(page.getByText("Rejeitado", { exact: true })).toBeVisible();
    // Sem pendentes: nenhuma ação de decisão sobra.
    await expect(page.getByRole("button", { name: "Validar apontamento" })).toHaveCount(0);
  });

  test("TECHNICIAN vê o erro do back no dialog de rejeição e ele continua aberto", async ({ page }) => {
    await loginAs(page, "TECHNICIAN", {
      id: "cccccccc-1111-0000-0000-000000000001",
      fullName: "Tereza Técnica",
      email: "tereza.tech@example.com",
      cpf: "55566677788",
      role: "TECHNICIAN",
      dateOfBirth: null,
    });
    await mockPlan(page, [makeExecution("ex-a", "2026-05-10")]);
    await page.route("**/production-executions/*/reject", (route) =>
      route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ message: "Técnico sem acesso a esta comunidade." }),
      }),
    );

    await page.goto(PLAN_URL);
    await page.getByRole("button", { name: "Rejeitar apontamento" }).click();
    const dialog = page.getByRole("alertdialog", { name: "Rejeitar apontamento" });
    await dialog.getByLabel("Motivo (opcional)").fill("Quantidade inconsistente");
    await dialog.getByRole("button", { name: "Rejeitar", exact: true }).click();

    await expect(dialog.getByRole("alert")).toContainText("Técnico sem acesso a esta comunidade.");
    await expect(dialog).toBeVisible();
  });

  test("FARMER nunca vê Validar/Rejeitar e corrige o apontamento rejeitado, que volta a Pendente", async ({
    page,
  }) => {
    await loginAs(page, "FARMER", {
      id: PRODUCER_ANA.user.id,
      fullName: PRODUCER_ANA.user.fullName,
      email: PRODUCER_ANA.user.email,
      cpf: PRODUCER_ANA.user.cpf,
      role: "FARMER",
      dateOfBirth: null,
    });

    const rejected = {
      ...makeExecution("ex-r", "2026-05-10", "REJECTED"),
      rejectionReason: "Quantidade acima do esperado",
      validatedAt: "2026-05-11T09:00:00",
    };
    const executions = [rejected];
    await mockPlan(page, executions);

    let putBody: Record<string, unknown> | null = null;
    await page.route("**/production-executions/ex-r", async (route) => {
      if (route.request().method() !== "PUT") {
        await route.fallback();
        return;
      }
      putBody = route.request().postDataJSON();
      Object.assign(executions[0], {
        quantity: 8,
        quantityKg: 480,
        status: "PENDING",
        rejectionReason: null,
        validatedAt: null,
      });
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(executions[0]) });
    });

    await page.goto(PLAN_URL);

    await expect(page.getByText("Rejeitado", { exact: true })).toBeVisible();
    await expect(page.getByText("Motivo: Quantidade acima do esperado")).toBeVisible();
    await expect(page.getByRole("button", { name: "Validar apontamento" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Rejeitar apontamento" })).toHaveCount(0);
    // Rejeitado não se exclui.
    await expect(page.getByRole("button", { name: "Excluir apontamento" })).toHaveCount(0);

    await page.getByRole("button", { name: "Editar apontamento" }).click();
    await expect(
      page.getByText("Alterar quantidade ou data reenvia o apontamento para validação."),
    ).toBeVisible();
    await page.getByLabel(/Quantidade colhida/).fill("8");
    await page.getByRole("button", { name: "Salvar alterações" }).click();

    await expect(page.getByText("Pendente", { exact: true })).toBeVisible();
    await expect(page.getByText("Rejeitado", { exact: true })).toHaveCount(0);
    expect(putBody).not.toBeNull();
    expect(putBody).not.toHaveProperty("status");
    expect(putBody).not.toHaveProperty("validatedBy");
    expect(putBody).not.toHaveProperty("validatedAt");
  });
});
