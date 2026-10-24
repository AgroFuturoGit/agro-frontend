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

for (const role of ["ADMIN", "MANAGER"]) {
  test(`${role} vê o painel da Visão geral com a tabela por comunidade`, async ({
    page,
  }) => {
    await loginAs(page, role);
    await seedUser(page, role);
    await page.route("**/production/dashboard", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(DASHBOARD) }),
    );

    await page.goto("/admin");

    await expect(page.getByText("40.000 kg")).toBeVisible();
    await expect(page.getByRole("img", { name: "45% da meta alcançada" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Alto da Serra" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Sem comunidade" })).toBeVisible();
  });
}

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

test("erro do painel mostra a mensagem do back e 'Tentar novamente' recupera", async ({
  page,
}) => {
  await loginAs(page, "ADMIN");
  await seedUser(page, "ADMIN");
  let calls = 0;
  await page.route("**/production/dashboard", (route) => {
    calls += 1;
    if (calls === 1) {
      return route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ message: "Técnico não encontrado." }),
      });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(DASHBOARD) });
  });

  await page.goto("/admin");

  await expect(page.getByText("Técnico não encontrado.")).toBeVisible();
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.getByText("40.000 kg")).toBeVisible();
});
