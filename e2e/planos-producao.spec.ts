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
 * Agrava o caso aqui: `GET /producers` (TECHNICIAN) e
 * `GET /producers/{id}/production-plans` (MANAGER) dependem das correções
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
  aliasName: null,
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
  aliasName: null,
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
    },
    harvest: {
      id: "0b0b0b0b-0000-0000-0000-000000000001",
      label: "Safra 2026",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
    },
    plantedArea: 12.5,
    expectedYield: 30,
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

    await page.route("**/producers*", async (route) => {
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
      "**/producers/*/production-plans*",
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

    // "Novo plano" é hasRole('PRODUCER', 'ADMIN', 'TECHNICIAN') no backend —
    // TECHNICIAN escreve, então o botão aparece (não-regressão RN da
    // migração; só delete continua ADMIN/TECHNICIAN apenas).
    await expect(page.getByRole("cell", { name: /Café — Catuaí/ })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Safra 2026" })).toBeVisible();

    // Sem seletor de produtor — o escopo vem inteiramente da URL.
    await expect(page.getByRole("combobox")).toHaveCount(0);

    expect(planRequests).toHaveLength(1);
    expect(planRequests[0]).toContain(
      `/producers/${PRODUCER_ANA.id}/production-plans`,
    );
  });

  test("PRODUCER cai direto nos próprios planos ao acessar /admin/organizacoes, sem seletor de produtor", async ({
    page,
  }) => {
    const producerUser: FakeUser = {
      id: PRODUCER_ANA.user.id,
      fullName: PRODUCER_ANA.user.fullName,
      email: PRODUCER_ANA.user.email,
      cpf: PRODUCER_ANA.user.cpf,
      role: "PRODUCER",
      dateOfBirth: "1990-04-02",
    };

    await loginAs(page, "PRODUCER", producerUser);

    // Rede de segurança contra regressão: o PRODUCER nunca deve listar
    // produtores nem organizações/comunidades — o caminho dele é inteiro via
    // `GET /producers/me` (que já traz comunidade+organização aninhadas).
    const listProducersRequests: string[] = [];
    await page.route("**/producers*", async (route) => {
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

    await page.route("**/producers/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(PRODUCER_ANA),
      });
    });

    await page.route(
      "**/producers/*/production-plans*",
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

    // `/admin/organizacoes` é o único ponto de entrada — PRODUCER é
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

    // Proibição explícita: o PRODUCER não vê seletor de produtor nem lista
    // GET /producers.
    await expect(page.getByRole("combobox")).toHaveCount(0);
    expect(listProducersRequests).toHaveLength(0);

    // Sem regressão do fluxo do próprio produtor.
    await expect(
      page.getByRole("button", { name: "Novo plano" }),
    ).toBeVisible();

    // Breadcrumb mostra a hierarquia real do produtor, resolvida via
    // `GET /producers/me` — não navegável para outro recurso (só o último
    // nível é não-clicável; os anteriores levam sempre aos próprios
    // recursos do produtor).
    const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(breadcrumb).toContainText(ORGANIZATION.name);
    await expect(breadcrumb).toContainText(COMMUNITY_A.name);
  });
});
