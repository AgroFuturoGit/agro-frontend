import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * ⚠️ ESCOPO DESTE ARQUIVO — LEIA ANTES DE CONFIAR NO VERDE.
 *
 * A sessão aqui é FABRICADA (cookies `agro_token`/`agro_role` +
 * `localStorage["agro_user"]`, decisão D5 de F01) e a API é INTEIRAMENTE
 * MOCKADA via `page.route()`. Nenhuma requisição chega ao backend Spring —
 * mesmo padrão de `e2e/hierarchy.spec.ts`, `e2e/produtores.spec.ts` e
 * `e2e/planos-producao.spec.ts`.
 *
 * Cobre o drill-down novo introduzido pelo plano
 * `navegacao-cascata-organizacoes`: Organização → Comunidade → Produtor →
 * Planos → Detalhe, um único ponto de entrada em `/admin/organizacoes`.
 *
 * NOTA (histórico): até `relatorio-evidencias-f03/relatorio-navegacao-
 * cascata-08-08.pdf`, TECHNICIAN era tratado como ADMIN nesta navegação
 * (mesma lista de organizações), o que 403ava contra o backend real —
 * `GET /organizations` é `hasRole('ADMIN')`. A resposta do backend em
 * `issues-fix-back.pdf` (itens 7/8) trocou o desenho: TECHNICIAN não navega
 * mais pela cascata institucional, ele cai direto na lista de produtores
 * atribuídos a ele via `GET /technicians/me/producers`. Ver o cenário
 * "TECHNICIAN cai direto na lista de produtores atendidos" abaixo.
 */

const AUTH_TOKEN_COOKIE = "agro_token";
const AUTH_ROLE_COOKIE = "agro_role";
const AUTH_USER_STORAGE_KEY = "agro_user";

type FakeUser = {
  id: string;
  fullName: string;
  email: string;
  cpf: string;
  role: string;
  dateOfBirth: string | null;
};

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
  id: "aaaaaaaa-2222-0000-0000-000000000001",
  name: "Cooperativa Serra Azul",
  taxId: "12345678000199",
  type: "COOP",
};

const OTHER_ORGANIZATION = {
  id: "aaaaaaaa-2222-0000-0000-000000000002",
  name: "Cooperativa Vale Verde",
  taxId: "98765432000188",
  type: "COOP",
};

const COMMUNITY = {
  id: "bbbbbbbb-2222-0000-0000-000000000001",
  name: "Comunidade Alto da Serra",
  organization: ORGANIZATION,
};

const PRODUCER = {
  id: "cccccccc-2222-0000-0000-000000000001",
  aliasName: "Zé da Serra",
  isCompliant: true,
  user: {
    id: "dddddddd-2222-0000-0000-000000000001",
    fullName: "José da Silva",
    email: "jose@example.com",
    cpf: "12345678901",
  },
  community: COMMUNITY,
};

const PLAN = {
  id: "eeeeeeee-2222-0000-0000-000000000001",
  crop: {
    id: "ffffffff-2222-0000-0000-000000000001",
    name: "Café",
    variety: "Catuaí",
  },
  harvest: {
    id: "00000000-2222-0000-0000-000000000001",
    label: "Safra 2026",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
  },
  plantedArea: 10,
  expectedYield: 25,
  plannedPlantingDate: "2026-09-01",
  createdAt: "2026-08-01T10:00:00Z",
};

const COMPARISON = {
  productionPlanId: PLAN.id,
  expectedYield: 25,
  totalActualYield: 10,
  difference: -15,
  percentageRealized: 40,
};

const ADMIN_USER: FakeUser = {
  id: "admin-user-1",
  fullName: "Adriana Admin",
  email: "adriana@example.com",
  cpf: "00011122233",
  role: "ADMIN",
  dateOfBirth: null,
};

const MANAGER_USER: FakeUser = {
  id: "manager-user-1",
  fullName: "Marta Gestora",
  email: "marta@example.com",
  cpf: "11122233344",
  role: "MANAGER",
  dateOfBirth: "1985-02-20",
};

const TECHNICIAN_USER: FakeUser = {
  id: "technician-user-1",
  fullName: "Tereza Técnica",
  email: "tereza@example.com",
  cpf: "55566677788",
  role: "TECHNICIAN",
  dateOfBirth: "1992-07-11",
};

const PRODUCER_USER: FakeUser = {
  id: PRODUCER.user.id,
  fullName: PRODUCER.user.fullName,
  email: PRODUCER.user.email,
  cpf: PRODUCER.user.cpf,
  role: "PRODUCER",
  dateOfBirth: "1990-04-02",
};

async function mockMyManager(page: Page, organization = ORGANIZATION) {
  await page.route("**/managers/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "manager-1",
        user: {
          id: MANAGER_USER.id,
          fullName: MANAGER_USER.fullName,
          email: MANAGER_USER.email,
          cpf: MANAGER_USER.cpf,
          role: "MANAGER",
          dateOfBirth: MANAGER_USER.dateOfBirth,
        },
        organization,
        createdAt: "2026-08-01T09:00:00Z",
        updatedAt: "2026-08-01T09:00:00Z",
      }),
    });
  });
}

async function mockOrganizations(page: Page, organizations = [ORGANIZATION]) {
  await page.route("**/organizations", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(organizations),
    });
  });
}

async function mockOrganizationById(page: Page, organization = ORGANIZATION) {
  await page.route(`**/organizations/${organization.id}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(organization),
    });
  });
}

async function mockCommunitiesList(page: Page, communities = [COMMUNITY]) {
  await page.route("**/communities?*", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(communities),
    });
  });
}

async function mockCommunityById(page: Page, community = COMMUNITY) {
  await page.route(`**/communities/${community.id}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(community),
    });
  });
}

async function mockProducersList(page: Page, producers = [PRODUCER]) {
  await page.route("**/producers?*", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(producers),
    });
  });
}

async function mockMyProducer(page: Page, producer = PRODUCER) {
  await page.route("**/producers/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(producer),
    });
  });
}

async function mockMyAssignedProducers(page: Page, producers = [PRODUCER]) {
  await page.route("**/technicians/me/producers", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(producers),
    });
  });
}

async function mockPlansForProducer(page: Page, plans: unknown[] = [PLAN]) {
  await page.route(`**/producers/${PRODUCER.id}/production-plans`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(plans),
    });
  });
}

async function mockPlanDetail(page: Page) {
  // Registrado ANTES das rotas mais específicas — no Playwright, o último
  // `page.route()` registrado tem prioridade, então os handlers de
  // `/comparison` e `/executions` abaixo precisam vir depois deste.
  await page.route(`**/production-plans/${PLAN.id}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(PLAN),
    });
  });
  await page.route(`**/production-plans/${PLAN.id}/comparison`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(COMPARISON),
    });
  });
  await page.route(`**/production-plans/${PLAN.id}/executions`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });
}

/**
 * `toContainText` com array espera múltiplos ELEMENTOS casados pelo
 * locator (um item do array por elemento) — não múltiplas substrings dentro
 * de um único elemento. O breadcrumb é um único `<nav>`, então a checagem
 * correta é ler o texto inteiro e conferir cada rótulo como substring.
 */
async function expectBreadcrumbContains(page: Page, labels: string[]) {
  const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
  // `toContainText` (ao contrário de ler `innerText` uma vez) espera/repete
  // até o texto aparecer — necessário porque os nomes do breadcrumb chegam
  // de um GET assíncrono e começam em rótulo genérico ("Organização") antes
  // de resolver.
  for (const label of labels) {
    await expect(breadcrumb).toContainText(label);
  }
}

test.describe("Navegação em cascata — Organização → Comunidade → Produtor → Planos", () => {
  test("ADMIN navega por todos os níveis com breadcrumb correto em cada um", async ({
    page,
  }) => {
    await loginAs(page, "ADMIN", ADMIN_USER);
    await mockOrganizations(page);
    await mockOrganizationById(page);
    await mockCommunitiesList(page);
    await mockCommunityById(page);
    await mockProducersList(page);
    await mockPlansForProducer(page);
    await mockPlanDetail(page);

    await page.goto("/admin/organizacoes");
    await expect(page.getByRole("link", { name: ORGANIZATION.name })).toBeVisible();

    await page.getByRole("link", { name: ORGANIZATION.name }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/organizacoes/${ORGANIZATION.id}$`));
    await expectBreadcrumbContains(page, ["Organizações", ORGANIZATION.name]);

    await page.getByRole("link", { name: COMMUNITY.name }).click();
    await expect(page).toHaveURL(
      new RegExp(`/admin/organizacoes/${ORGANIZATION.id}/comunidades/${COMMUNITY.id}$`),
    );
    await expectBreadcrumbContains(page, [
      "Organizações",
      ORGANIZATION.name,
      COMMUNITY.name,
    ]);

    await page.getByRole("link", { name: "José da Silva" }).click();
    await expect(page).toHaveURL(
      new RegExp(
        `/admin/organizacoes/${ORGANIZATION.id}/comunidades/${COMMUNITY.id}/produtores/${PRODUCER.id}$`,
      ),
    );
    await expectBreadcrumbContains(page, [
      "Organizações",
      ORGANIZATION.name,
      COMMUNITY.name,
      "José da Silva",
    ]);

    await page.getByRole("link", { name: /Café — Catuaí/ }).click();
    await expect(page).toHaveURL(
      new RegExp(
        `/admin/organizacoes/${ORGANIZATION.id}/comunidades/${COMMUNITY.id}/produtores/${PRODUCER.id}/planos/${PLAN.id}$`,
      ),
    );
    await expectBreadcrumbContains(page, [
      "Organizações",
      ORGANIZATION.name,
      COMMUNITY.name,
      "José da Silva",
      "Café — Catuaí",
    ]);
    await expect(page.getByRole("heading", { name: "Café — Catuaí" })).toBeVisible();
  });

  test("MANAGER acessando /admin/organizacoes é redirecionado automaticamente para a própria organização, sem ver a lista completa", async ({
    page,
  }) => {
    await loginAs(page, "MANAGER", MANAGER_USER);
    await mockMyManager(page);
    await mockCommunitiesList(page, []);

    let organizationsListRequested = false;
    await page.route("**/organizations", async (route) => {
      if (route.request().method() === "GET") organizationsListRequested = true;
      await route.fallback();
    });

    await page.goto("/admin/organizacoes");

    await expect(page).toHaveURL(new RegExp(`/admin/organizacoes/${ORGANIZATION.id}$`));
    expect(organizationsListRequested).toBe(false);
    await expect(page.getByText("Nenhuma organização cadastrada ainda.")).toHaveCount(0);
  });

  test("MANAGER tentando acessar a URL de outra organização é bloqueado e redirecionado para a própria (guarda de ownership)", async ({
    page,
  }) => {
    await loginAs(page, "MANAGER", MANAGER_USER);
    await mockMyManager(page);
    // Comunidades da PRÓPRIA organização — necessário para o org page
    // renderizar com sucesso depois do redirecionamento.
    await mockCommunitiesList(page, []);

    // `GET /organizations/{outraOrg}` nunca deveria ser necessário para o
    // MANAGER (guarda client-side, memória `lesson-backend-hierarchy-
    // ownership`) — se a página tentasse buscar dados de outra organização
    // antes de checar o ownership, esta rota exporia isso.
    let otherOrgDataRequested = false;
    await page.route(`**/communities?orgId=${OTHER_ORGANIZATION.id}`, async (route) => {
      otherOrgDataRequested = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.goto(`/admin/organizacoes/${OTHER_ORGANIZATION.id}`);

    await expect(page).toHaveURL(new RegExp(`/admin/organizacoes/${ORGANIZATION.id}$`));
    expect(otherOrgDataRequested).toBe(false);
  });

  test("TECHNICIAN cai direto na lista de produtores atendidos, sem passar pela cascata institucional", async ({
    page,
  }) => {
    await loginAs(page, "TECHNICIAN", TECHNICIAN_USER);
    await mockMyAssignedProducers(page);

    await page.goto("/admin/organizacoes");

    // Fica na mesma URL (`/admin/organizacoes`), mas não é a lista de
    // organizações — é a lista de produtores atribuídos via
    // `GET /technicians/me/producers` (issues-fix-back.pdf itens 7/8).
    await expect(page).toHaveURL(/\/admin\/organizacoes$/);
    await expect(
      page.getByRole("heading", { name: "Meus produtores atendidos" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: PRODUCER.user.fullName }),
    ).toBeVisible();
    await expect(page.getByText(ORGANIZATION.name)).toBeVisible();
    await expect(page.getByText(COMMUNITY.name)).toBeVisible();
  });

  test("TECHNICIAN abre um produtor atendido e chega nos planos dele", async ({
    page,
  }) => {
    await loginAs(page, "TECHNICIAN", TECHNICIAN_USER);
    await mockMyAssignedProducers(page);
    await mockPlansForProducer(page, [PLAN]);
    // `GET /communities/{id}` e `GET /producers` continuam
    // `hasRole('MANAGER') or hasRole('ADMIN')` no backend real — o
    // breadcrumb da página de planos precisa tolerar o 403 e cair em
    // rótulos genéricos, sem impedir a listagem de planos de carregar.
    await page.route(`**/communities/${COMMUNITY.id}`, async (route) => {
      await route.fulfill({ status: 403, contentType: "application/json", body: "{}" });
    });
    await page.route("**/producers?*", async (route) => {
      await route.fulfill({ status: 403, contentType: "application/json", body: "{}" });
    });

    await page.goto("/admin/organizacoes");
    await page.getByRole("link", { name: PRODUCER.user.fullName }).click();

    await expect(page).toHaveURL(
      new RegExp(
        `/admin/organizacoes/${ORGANIZATION.id}/comunidades/${COMMUNITY.id}/produtores/${PRODUCER.id}$`,
      ),
    );
    await expect(page.getByRole("cell", { name: /Café — Catuaí/ })).toBeVisible();
  });

  test("PRODUCER acessando /admin/organizacoes cai direto nos próprios planos, com breadcrumb real", async ({
    page,
  }) => {
    await loginAs(page, "PRODUCER", PRODUCER_USER);
    await mockMyProducer(page);
    await mockPlansForProducer(page, [PLAN]);

    await page.goto("/admin/organizacoes");

    await expect(page).toHaveURL(
      new RegExp(
        `/admin/organizacoes/${ORGANIZATION.id}/comunidades/${COMMUNITY.id}/produtores/${PRODUCER.id}$`,
      ),
    );
    await expect(page.getByRole("cell", { name: /Café — Catuaí/ })).toBeVisible();

    await expectBreadcrumbContains(page, [
      "Organizações",
      ORGANIZATION.name,
      COMMUNITY.name,
    ]);
  });

  test("estados vazios: organização sem comunidades, comunidade sem produtores e produtor sem planos mostram mensagem de vazio (não erro)", async ({
    page,
  }) => {
    await loginAs(page, "ADMIN", ADMIN_USER);
    await mockOrganizationById(page);
    await mockCommunityById(page);
    await mockCommunitiesList(page, []);
    await mockProducersList(page, []);
    await mockPlansForProducer(page, []);

    await page.goto(`/admin/organizacoes/${ORGANIZATION.id}`);
    await expect(
      page.getByText("Nenhuma comunidade cadastrada nesta organização ainda."),
    ).toBeVisible();
    // Não usa `getByRole("alert")` aqui: o Next.js injeta um elemento
    // `role="alert"` global (route announcer de acessibilidade) em toda
    // página, independente de erro da aplicação. O banner de erro real desta
    // base de código sempre começa com "Não foi possível".
    await expect(page.getByText(/Não foi possível/)).toHaveCount(0);

    await page.goto(`/admin/organizacoes/${ORGANIZATION.id}/comunidades/${COMMUNITY.id}`);
    await expect(
      page.getByText("Nenhum produtor cadastrado nesta comunidade ainda."),
    ).toBeVisible();
    // Não usa `getByRole("alert")` aqui: o Next.js injeta um elemento
    // `role="alert"` global (route announcer de acessibilidade) em toda
    // página, independente de erro da aplicação. O banner de erro real desta
    // base de código sempre começa com "Não foi possível".
    await expect(page.getByText(/Não foi possível/)).toHaveCount(0);

    await page.goto(
      `/admin/organizacoes/${ORGANIZATION.id}/comunidades/${COMMUNITY.id}/produtores/${PRODUCER.id}`,
    );
    await expect(
      page.getByText("Nenhum plano de produção cadastrado ainda."),
    ).toBeVisible();
    // Não usa `getByRole("alert")` aqui: o Next.js injeta um elemento
    // `role="alert"` global (route announcer de acessibilidade) em toda
    // página, independente de erro da aplicação. O banner de erro real desta
    // base de código sempre começa com "Não foi possível".
    await expect(page.getByText(/Não foi possível/)).toHaveCount(0);
  });

  test.describe("Sidebar — itens antigos não existem mais para nenhuma role", () => {
    for (const role of ["ADMIN", "MANAGER", "TECHNICIAN", "PRODUCER"]) {
      test(`role=${role}: 'Comunidades', 'Produtores' e 'Planos de Produção' não aparecem na sidebar`, async ({
        page,
      }) => {
        await loginAs(page, role, {
          id: "sidebar-user",
          fullName: "Usuário Sidebar",
          email: "sidebar@example.com",
          cpf: "00000000000",
          role,
          dateOfBirth: null,
        });
        await mockMyManager(page);
        await mockMyProducer(page);
        await mockOrganizations(page);
        await mockMyAssignedProducers(page, []);
        await mockCommunitiesList(page, []);
        await mockPlansForProducer(page, []);

        await page.goto("/admin/organizacoes");

        // Escopado ao container da sidebar (`data-slot="sidebar"`): em rotas
        // aninhadas o breadcrumb também tem um item de texto "Organizações",
        // então uma busca ampla por texto seria ambígua (dois elementos).
        const sidebar = page.locator('[data-slot="sidebar"]');
        await expect(
          sidebar.getByRole("link", { name: "Organizações" }),
        ).toBeVisible();
        await expect(sidebar.getByText("Comunidades", { exact: true })).toHaveCount(0);
        await expect(sidebar.getByText("Produtores", { exact: true })).toHaveCount(0);
        await expect(
          sidebar.getByText("Planos de Produção", { exact: true }),
        ).toHaveCount(0);
      });
    }
  });
});
