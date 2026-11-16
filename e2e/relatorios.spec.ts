import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * Filtro de safra em Relatórios (FARMER), com a API inteiramente mockada via
 * `page.route()`. As rotas mockadas são só as que `reports-page.tsx` chama:
 * `GET /farmers/me` (`getMyProducer`), `GET /farmers/{id}/production-plans`
 * (`listProductionPlans`), `GET /production-plans/{id}/comparison`
 * (`getProductionComparison`) e `GET /analytics/farmers/me/summary`
 * (`getFarmerSummary`). Verde aqui prova a UI, não a integração com o back.
 */

const AUTH_TOKEN_COOKIE = "agro_token";
const AUTH_ROLE_COOKIE = "agro_role";
// Chave usada por `persistSession`/`readUserFromStorage` em `src/lib/auth.ts`.
const AUTH_USER_STORAGE_KEY = "agro_user";

const FARMER_USER = {
  id: "ffffffff-2222-0000-0000-000000000001",
  fullName: "Ana Serrana",
  email: "ana@example.com",
  cpf: "12345678909",
  role: "FARMER",
  dateOfBirth: "1990-03-15",
};

/** Sessão fabricada (cookies + localStorage), como em `rbac.spec.ts`. */
async function loginAsFarmer(page: Page) {
  // Com token falso o back real encerraria a sessão: o mock responde 200 e o
  // refresh do layout ignora o corpo sem usuário.
  await page.route("**/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.context().addCookies([
    { name: AUTH_TOKEN_COOKIE, value: "e2e-fake-token", url: "http://localhost:3000" },
    { name: AUTH_ROLE_COOKIE, value: "FARMER", url: "http://localhost:3000" },
  ]);
  await page.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, value);
    },
    { key: AUTH_USER_STORAGE_KEY, value: JSON.stringify(FARMER_USER) },
  );
}

const json = (body: unknown, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

const ORGANIZATION = {
  id: "aaaaaaaa-2222-0000-0000-000000000001",
  name: "Cooperativa Serra Azul",
  taxId: "12345678000199",
  type: "COOP",
};

const PRODUCER = {
  id: "eeeeeeee-2222-0000-0000-000000000001",
  fullName: "Ana Serrana",
  isCompliant: true,
  community: {
    id: "bbbbbbbb-2222-0000-0000-000000000001",
    name: "Comunidade Alto da Serra",
    organization: ORGANIZATION,
  },
};

const HARVEST_A = {
  id: "0b0b0b0b-2222-0000-0000-00000000000a",
  label: "Safra 2026",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
};

const HARVEST_B = {
  id: "0b0b0b0b-2222-0000-0000-00000000000b",
  label: "Safra 2025",
  startDate: "2025-01-01",
  endDate: "2025-12-31",
};

function plan(id: string, cropName: string, variety: string, harvest: typeof HARVEST_A) {
  return {
    id,
    crop: {
      id: `crop-${id}`,
      name: cropName,
      variety,
      isPriority: false,
      cycleDays: 120,
      expectedProductivity: 1000,
      harvestType: "SINGLE",
      unit: "KG",
      unitWeightKg: 1,
    },
    harvest,
    plantedArea: 1,
    status: "ACTIVE",
    expectedHarvestStart: null,
    expectedHarvestEnd: null,
    expectedProductivity: 1000,
    plannedPlantingDate: null,
    createdAt: "2026-01-10T10:00:00Z",
  };
}

const PLANS = [
  plan("plan-milho-a", "Milho", "BRS", HARVEST_A),
  plan("plan-feijao-a", "Feijão", "Carioca", HARVEST_A),
  plan("plan-cafe-b", "Café", "Catuaí", HARVEST_B),
];

const CARD_A1 = "Milho — BRS";
const CARD_A2 = "Feijão — Carioca";
const CARD_B1 = "Café — Catuaí";

/** Monta as rotas da tela; devolve o contador de chamadas de comparação. */
async function mockReports(
  page: Page,
  currentHarvest: typeof HARVEST_A | null,
) {
  const calls = { comparisons: 0 };
  await page.route("**/farmers/me", (route) => route.fulfill(json(PRODUCER)));
  await page.route(`**/farmers/${PRODUCER.id}/production-plans`, (route) =>
    route.fulfill(json(PLANS)),
  );
  await page.route("**/production-plans/*/comparison", (route) => {
    calls.comparisons += 1;
    const planId = route.request().url().split("/production-plans/")[1].split("/")[0];
    return route.fulfill(
      json({
        productionPlanId: planId,
        expectedYield: 1000,
        totalActualYield: 500,
        difference: -500,
        percentageRealized: 50,
      }),
    );
  });
  await page.route("**/analytics/farmers/me/summary*", (route) =>
    route.fulfill(
      json({
        farmerId: PRODUCER.id,
        farmerName: PRODUCER.fullName,
        communityName: PRODUCER.community.name,
        currentHarvest,
        isEmpty: false,
        totalPlansCount: 3,
        activePlotsCount: 3,
        totalPlantedAreaHa: 3,
        totalTargetKg: 3000,
        totalRealizedKg: 1500,
        totalPendingKg: 0,
        overallCompletionPct: 50,
        plans: [],
      }),
    ),
  );
  return calls;
}

/** Texto da safra escolhida (o gatilho também traz o ícone ▼ como texto). */
function selectedHarvest(page: Page) {
  return page
    .getByRole("combobox", { name: "Safra", exact: true })
    .locator('[data-slot="select-value"]');
}

/** Os cards de plano ficam na seção "Por plano de produção". */
function planCards(page: Page) {
  return page.getByRole("region", { name: "Por plano de produção", exact: true });
}

async function expectCards(page: Page, visible: string[], hidden: string[]) {
  const section = planCards(page);
  await expect(section.getByRole("link", { name: /^Ver detalhes de / })).toHaveCount(
    visible.length,
  );
  for (const title of visible) {
    await expect(section.getByText(title, { exact: true })).toBeVisible();
  }
  for (const title of hidden) {
    await expect(section.getByText(title, { exact: true })).toHaveCount(0);
  }
}

test.describe("Relatórios — filtro de safra (FARMER)", () => {
  test("abre na safra vigente e mostra só os planos dela", async ({ page }) => {
    await loginAsFarmer(page);
    await mockReports(page, HARVEST_A);

    await page.goto("/admin/relatorios");

    await expect(selectedHarvest(page)).toHaveText(/^Safra 2026$/);
    await expectCards(page, [CARD_A1, CARD_A2], [CARD_B1]);
  });

  test("trocar para 'Todas as safras' mostra os planos das duas safras, sem nova comparação", async ({
    page,
  }) => {
    await loginAsFarmer(page);
    const calls = await mockReports(page, HARVEST_A);

    await page.goto("/admin/relatorios");

    const harvestSelect = page.getByRole("combobox", { name: "Safra", exact: true });
    await expectCards(page, [CARD_A1, CARD_A2], [CARD_B1]);
    const comparisonsBefore = calls.comparisons;
    expect(comparisonsBefore).toBe(PLANS.length);

    await harvestSelect.click();
    await page.getByRole("option", { name: "Todas as safras", exact: true }).click();

    await expect(selectedHarvest(page)).toHaveText(/^Todas as safras$/);
    await expectCards(page, [CARD_A1, CARD_A2, CARD_B1], []);
    expect(calls.comparisons).toBe(comparisonsBefore);
  });

  test("sem safra vigente, abre em 'Todas as safras'", async ({ page }) => {
    await loginAsFarmer(page);
    await mockReports(page, null);

    await page.goto("/admin/relatorios");

    await expect(selectedHarvest(page)).toHaveText(/^Todas as safras$/);
    await expectCards(page, [CARD_A1, CARD_A2, CARD_B1], []);
  });
});
