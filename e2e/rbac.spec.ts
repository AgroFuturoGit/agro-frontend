import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

const AUTH_TOKEN_COOKIE = "agro_token";
const AUTH_ROLE_COOKIE = "agro_role";

/**
 * Fabrica a sessão via cookies (decisão D5) em vez de logar de verdade
 * pelo formulário `/login`. Mantém o teste determinístico e sem
 * dependência de um backend real.
 */
async function loginAs(page: Page, role: string) {
  // A sessão é conferida em `GET /auth/me` quando a API devolve 401/403/500;
  // com token falso o back real encerraria a sessão, então o mock responde 200
  // (corpo sem usuário: o refresh do layout o ignora e mantém a sessão semeada).
  await page.route("**/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
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
}

test("MANAGER acessa /admin/organizacoes sem redirecionamento", async ({
  page,
}) => {
  await loginAs(page, "MANAGER");

  await page.goto("/admin/organizacoes");

  await expect(page).toHaveURL(/\/admin\/organizacoes/);
});

test("FARMER é redirecionado de /admin/perfis para /admin", async ({
  page,
}) => {
  await loginAs(page, "FARMER");

  await page.goto("/admin/perfis");

  await expect(page).toHaveURL(/\/admin$/);
});

/** O painel decide a tabela por comunidade pela role em `localStorage["agro_user"]`. */
async function seedUser(page: Page, role: string) {
  await page.addInitScript(
    ({ key, value }) => window.localStorage.setItem(key, value),
    {
      key: "agro_user",
      value: JSON.stringify({
        id: "00000000-0000-0000-0000-000000000001",
        fullName: `${role} E2E`,
        email: "e2e@example.com",
        cpf: "12345678909",
        role,
        dateOfBirth: null,
      }),
    },
  );
}

const DASHBOARD = {
  farmerCount: 3,
  planCount: 4,
  expectedYield: 40000,
  actualYield: 18000,
  difference: -22000,
  percentageRealized: 45,
  communities: [
    { communityId: "c-1", communityName: "Alto da Serra", farmerCount: 2, planCount: 3, expectedYield: 30000, actualYield: 18000, difference: -12000, percentageRealized: 60 },
    { communityId: null, communityName: "Sem comunidade", farmerCount: 1, planCount: 1, expectedYield: 10000, actualYield: 0, difference: -10000, percentageRealized: 0 },
  ],
};

const MANAGEMENT_SUMMARY = {
  scope: "ORGANIZATION",
  organizationId: "o-1",
  organizationName: "Cooperativa Sol",
  currentHarvest: { id: "h-1", label: "Safra 2026", startDate: "2026-01-01", endDate: "2026-12-31" },
  appliedCommunityId: null,
  isEmpty: false,
  totalOrganizationsCount: 1,
  totalCommunitiesCount: 2,
  totalFarmersCount: 10,
  compliantFarmersCount: 7,
  complianceRatePct: 70,
  totalPlansCount: 12,
  totalPlantedAreaHa: 33.5,
  totalTargetKg: 50000,
  totalRealizedKg: 20000,
  overallConversionRatePct: 40,
  cropRanking: [
    { rankPosition: 1, cropId: "k1", cropName: "Milho", cropVariety: "Crioulo", unit: "kg", plansCount: 9, plantedAreaHa: 28.5, targetKg: 40000, realizedKg: 15000, conversionRatePct: 37.5, productionSharePct: 75 },
    { rankPosition: 2, cropId: "k2", cropName: "Feijão", cropVariety: null, unit: "kg", plansCount: 3, plantedAreaHa: 5, targetKg: 10000, realizedKg: 5000, conversionRatePct: 50, productionSharePct: 25 },
  ],
  communities: [
    { communityId: "c-1", communityName: "Alto da Serra", organizationId: "o-1", organizationName: "Cooperativa Sol", activeFarmersCount: 6, compliantFarmersCount: 4, complianceRatePct: 66.67, plansCount: 7, plantedAreaHa: 20, targetKg: 30000, realizedKg: 12000, conversionRatePct: 40, lastExecutionDate: "2026-05-10" },
    { communityId: "c-2", communityName: "Vale Verde", organizationId: "o-1", organizationName: "Cooperativa Sol", activeFarmersCount: 4, compliantFarmersCount: 3, complianceRatePct: 75, plansCount: 5, plantedAreaHa: 13.5, targetKg: 20000, realizedKg: 8000, conversionRatePct: 40, lastExecutionDate: null },
  ],
  organizations: [],
};

const GLOBAL_SUMMARY = {
  ...MANAGEMENT_SUMMARY,
  scope: "GLOBAL",
  organizationId: null,
  organizationName: null,
  totalOrganizationsCount: 2,
  organizations: [
    { organizationId: "o-1", organizationName: "Cooperativa Sol", communitiesCount: 2, activeFarmersCount: 10, compliantFarmersCount: 7, complianceRatePct: 70, plansCount: 12, plantedAreaHa: 33.5, targetKg: 50000, realizedKg: 20000, conversionRatePct: 40 },
    { organizationId: "o-2", organizationName: "Associação Lua", communitiesCount: 1, activeFarmersCount: 3, compliantFarmersCount: 1, complianceRatePct: 33.33, plansCount: 2, plantedAreaHa: 4, targetKg: 4000, realizedKg: 100, conversionRatePct: 2.5 },
  ],
};

const json = (body: unknown, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

async function mockManagementOptions(page: Page) {
  await page.route("**/harvests", (route) => route.fulfill(json([])));
  await page.route("**/organizations", (route) => route.fulfill(json([])));
  await page.route("**/communities*", (route) => route.fulfill(json([])));
}

test("MANAGER vê o dashboard da organização na Visão geral, sem o painel de produção nem o global", async ({
  page,
}) => {
  await loginAs(page, "MANAGER");
  await seedUser(page, "MANAGER");
  await mockManagementOptions(page);
  let productionCalls = 0;
  let globalCalls = 0;
  const queries: string[] = [];
  await page.route("**/production/dashboard", (route) => {
    productionCalls += 1;
    return route.fulfill(json(DASHBOARD));
  });
  await page.route("**/analytics/global/summary*", (route) => {
    globalCalls += 1;
    return route.fulfill(json({ message: "Acesso negado" }, 403));
  });
  await page.route("**/analytics/organizations/me/summary*", (route) => {
    queries.push(new URL(route.request().url()).search);
    return route.fulfill(json(MANAGEMENT_SUMMARY));
  });

  await page.goto("/admin");

  await expect(page.getByTestId("mgmt-scope-title")).toHaveText("Cooperativa Sol");
  await expect(page.getByText("50.000 kg")).toBeVisible();
  await expect(page.getByTestId("crop-ranking")).toBeVisible();
  await expect(page.getByTestId("communities-table")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Organização" })).toHaveCount(0);
  await expect(page.getByTestId("organizations-table")).toHaveCount(0);
  expect(productionCalls).toBe(0);
  expect(globalCalls).toBe(0);
  expect(queries[0]).toBe("");
});

test("ADMIN vê o dashboard global com comparativo entre organizações", async ({ page }) => {
  await loginAs(page, "ADMIN");
  await seedUser(page, "ADMIN");
  await mockManagementOptions(page);
  let productionCalls = 0;
  await page.route("**/production/dashboard", (route) => {
    productionCalls += 1;
    return route.fulfill(json(DASHBOARD));
  });
  await page.route("**/analytics/global/summary*", (route) =>
    route.fulfill(json(GLOBAL_SUMMARY)),
  );

  await page.goto("/admin");

  await expect(page.getByTestId("mgmt-scope-title")).toHaveText("Todas as organizações");
  await expect(page.getByRole("combobox", { name: "Organização" })).toBeVisible();
  await expect(page.getByTestId("organizations-table")).toBeVisible();
  await expect(page.getByRole("cell", { name: "Associação Lua" })).toBeVisible();
  expect(productionCalls).toBe(0);
});

const FARMER_SUMMARY = {
  farmerId: "00000000-0000-0000-0000-000000000001",
  farmerName: "Zé",
  communityName: "Alto da Serra",
  currentHarvest: { id: "h-1", label: "Safra 2026", startDate: "2026-01-01", endDate: "2026-12-31" },
  isEmpty: false,
  totalPlansCount: 2,
  activePlotsCount: 2,
  totalPlantedAreaHa: 3.5,
  totalTargetKg: 5000,
  totalRealizedKg: 1200,
  totalPendingKg: 300,
  overallCompletionPct: 24,
  plans: [
    {
      planId: "p-1", cropId: "c-1", cropName: "Milho", cropVariety: "BRS", harvestType: "SINGLE", unit: "KG",
      status: "ACTIVE", locationDescription: "Talhão 1", plantedAreaHa: 2, targetKg: 3000, realizedKg: 1200,
      pendingKg: 300, completionPct: 40, progressStatus: "BELOW_EXPECTED", plantingDate: null,
      expectedHarvestStart: null, expectedHarvestEnd: null, lastExecutionDate: "2026-05-20",
    },
    {
      planId: "p-2", cropId: "c-2", cropName: "Feijão", cropVariety: null, harvestType: "SINGLE", unit: "KG",
      status: "PLANNED", locationDescription: null, plantedAreaHa: 1.5, targetKg: 2000, realizedKg: 0,
      pendingKg: 0, completionPct: 0, progressStatus: "NOT_STARTED", plantingDate: null,
      expectedHarvestStart: null, expectedHarvestEnd: null, lastExecutionDate: null,
    },
  ],
};

test("FARMER vê o dashboard do agricultor na Visão geral, sem o painel de produção", async ({
  page,
}) => {
  await loginAs(page, "FARMER");
  await seedUser(page, "FARMER");
  let productionDashboardCalls = 0;
  await page.route("**/production/dashboard", (route) => {
    productionDashboardCalls += 1;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(DASHBOARD) });
  });
  await page.route("**/analytics/farmers/me/summary*", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(FARMER_SUMMARY) }),
  );
  await page.route("**/harvests", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) }),
  );
  await page.route("**/farmers/me", (route) =>
    route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ message: "x" }) }),
  );

  await page.goto("/admin");

  await expect(page.getByText("Safra: Safra 2026")).toBeVisible();
  await expect(page.getByText("Pendente de validação")).toBeVisible();
  await expect(page.getByTestId("farmer-plan-card")).toHaveCount(2);
  await expect(page.getByText("Abaixo do esperado")).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
  expect(productionDashboardCalls).toBe(0);
});

const TECHNICIAN_SUMMARY = {
  technicianId: "t-1",
  technicianName: "Téc E2E",
  currentHarvest: { id: "h-1", label: "Safra 2026", startDate: "2026-01-01", endDate: "2026-12-31" },
  appliedCommunityId: null,
  appliedCropId: null,
  isEmpty: false,
  totalAssistedCommunitiesCount: 2,
  totalAssistedFarmersCount: 3,
  totalPlansCount: 5,
  activePlansCount: 4,
  totalPlantedAreaHa: 6,
  totalTargetKg: 1500,
  totalRealizedKg: 400,
  totalPendingKg: 100,
  pendingExecutionsCount: 7,
  overallCompletionPct: 26.67,
  totalWarningsCount: 2,
  warnings: [
    {
      planId: "p-1", farmerId: "f-1", farmerName: "Zé da Silva", communityId: "c-1", communityName: "Alto da Serra",
      cropId: "k-1", cropName: "Milho", cropVariety: "BRS", planStatus: "ACTIVE", progressStatus: "DELAYED",
      warningTypes: ["INACTIVE_EXECUTIONS"], severity: "MEDIUM", message: "Sem apontamentos há 20 dias",
      targetKg: 1000, realizedKg: 100, pendingKg: 0, expectedPaceKg: 500, completionPct: 10,
      lastExecutionDate: "2026-05-20", daysWithoutExecution: 20, expectedHarvestStart: null, expectedHarvestEnd: null,
    },
    {
      planId: "p-2", farmerId: "f-2", farmerName: "Maria Souza", communityId: "c-2", communityName: "Vale Verde",
      cropId: "k-2", cropName: "Feijão", cropVariety: null, planStatus: "ACTIVE", progressStatus: "DELAYED",
      warningTypes: ["HARVEST_OVERDUE", "LOW_YIELD_RISK"], severity: "HIGH", message: "Janela de colheita encerrada",
      targetKg: 500, realizedKg: 0, pendingKg: 0, expectedPaceKg: 500, completionPct: 0,
      lastExecutionDate: null, daysWithoutExecution: null, expectedHarvestStart: null, expectedHarvestEnd: null,
    },
  ],
  communities: [
    { communityId: "c-1", communityName: "Alto da Serra", assistedFarmersCount: 2, farmersWithPlansCount: 2, plansCount: 3, plantedAreaHa: 4, targetKg: 1000, realizedKg: 400, pendingKg: 100, completionPct: 40, warningsCount: 1 },
    { communityId: "c-2", communityName: "Vale Verde", assistedFarmersCount: 1, farmersWithPlansCount: 1, plansCount: 2, plantedAreaHa: 2, targetKg: 500, realizedKg: 0, pendingKg: 0, completionPct: 0, warningsCount: 1 },
  ],
  farmers: [
    { farmerId: "f-1", farmerName: "Zé da Silva", communityId: "c-1", communityName: "Alto da Serra", isCompliant: true, plansCount: 3, activePlansCount: 2, plantedAreaHa: 4, targetKg: 1000, realizedKg: 400, pendingKg: 100, completionPct: 40, lastExecutionDate: "2026-05-20", warningsCount: 1 },
    { farmerId: "f-2", farmerName: "Maria Souza", communityId: "c-2", communityName: "Vale Verde", isCompliant: false, plansCount: 2, activePlansCount: 2, plantedAreaHa: 2, targetKg: 500, realizedKg: 0, pendingKg: 0, completionPct: 0, lastExecutionDate: null, warningsCount: 1 },
  ],
};

test("TECHNICIAN vê o dashboard do técnico na Visão geral, sem o painel de produção", async ({
  page,
}) => {
  await loginAs(page, "TECHNICIAN");
  await seedUser(page, "TECHNICIAN");
  let productionDashboardCalls = 0;
  const summaryQueries: string[] = [];
  await page.route("**/production/dashboard", (route) => {
    productionDashboardCalls += 1;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(DASHBOARD) });
  });
  await page.route("**/analytics/technicians/me/summary*", (route) => {
    summaryQueries.push(new URL(route.request().url()).search);
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(TECHNICIAN_SUMMARY) });
  });
  await page.route("**/harvests", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) }),
  );
  await page.route("**/crops", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) }),
  );
  await page.route("**/technicians/me/farmers", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) }),
  );

  await page.goto("/admin");

  await expect(page.getByText("Safra: Safra 2026")).toBeVisible();
  await expect(page.getByText("Comunidades atendidas")).toBeVisible();
  await expect(page.getByText("7 apontamentos pendentes")).toBeVisible();
  await expect(page.getByTestId("warning-card")).toHaveCount(2);
  await expect(page.getByText("Severidade Alta")).toBeVisible();
  await expect(page.getByTestId("community-bar-chart")).toBeVisible();
  await expect(page.getByRole("cell", { name: "Zé da Silva" })).toBeVisible();
  await expect(page.getByText("Pendências")).toBeVisible();
  expect(productionDashboardCalls).toBe(0);
  expect(summaryQueries[0]).toBe("");
});

test("TECHNICIAN: 403 de comunidade não assistida mostra a mensagem e 'Voltar para Todas' recupera", async ({
  page,
}) => {
  await loginAs(page, "TECHNICIAN");
  await seedUser(page, "TECHNICIAN");
  await page.route("**/analytics/technicians/me/summary*", (route) => {
    if (new URL(route.request().url()).searchParams.has("communityId")) {
      return route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ message: "Comunidade não assistida pelo técnico logado." }),
      });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(TECHNICIAN_SUMMARY) });
  });
  await page.route("**/harvests", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) }),
  );
  await page.route("**/crops", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) }),
  );
  await page.route("**/technicians/me/farmers", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) }),
  );

  await page.goto("/admin");
  await expect(page.getByText("Comunidades atendidas")).toBeVisible();

  await page.getByRole("combobox", { name: "Comunidade" }).click();
  await page.getByRole("option", { name: "Vale Verde" }).click();

  await expect(page.getByText("Comunidade não assistida pelo técnico logado.")).toBeVisible();
  await page.getByRole("button", { name: "Voltar para Todas" }).click();
  await expect(page.getByText("Comunidades atendidas")).toBeVisible();
  await expect(page.getByText("Comunidade não assistida pelo técnico logado.")).toHaveCount(0);
});

test("erro do painel mostra a mensagem do back e 'Tentar novamente' recupera", async ({
  page,
}) => {
  await loginAs(page, "ADMIN");
  await seedUser(page, "ADMIN");
  await mockManagementOptions(page);
  // O modo dev do React executa o efeito duas vezes: a falha vale até o retry.
  let failing = true;
  await page.route("**/analytics/global/summary*", (route) =>
    failing
      ? route.fulfill(json({ message: "Falha ao consultar o resumo." }, 403))
      : route.fulfill(json(GLOBAL_SUMMARY)),
  );

  await page.goto("/admin");

  await expect(page.getByText("Falha ao consultar o resumo.")).toBeVisible();
  failing = false;
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.getByText("50.000 kg")).toBeVisible();
});
