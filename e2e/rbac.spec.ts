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

for (const role of ["ADMIN", "MANAGER", "TECHNICIAN"]) {
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

test("FARMER vê o painel da Visão geral sem a tabela por comunidade", async ({
  page,
}) => {
  await loginAs(page, "FARMER");
  await seedUser(page, "FARMER");
  await page.route("**/production/dashboard", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...DASHBOARD, communities: [DASHBOARD.communities[0]] }) }),
  );

  await page.goto("/admin");

  await expect(page.getByText("40.000 kg")).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
});

test("erro do painel mostra a mensagem do back e 'Tentar novamente' recupera", async ({
  page,
}) => {
  await loginAs(page, "TECHNICIAN");
  await seedUser(page, "TECHNICIAN");
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
