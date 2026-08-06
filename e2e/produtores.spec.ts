import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * ⚠️ ESCOPO DESTE ARQUIVO — LEIA ANTES DE CONFIAR NO VERDE.
 *
 * A sessão aqui é FABRICADA (cookies `agro_token`/`agro_role` +
 * `localStorage["agro_user"]`, decisão D5 de F01) e a API é INTEIRAMENTE
 * MOCKADA via `page.route()`. Nenhuma requisição chega ao backend Spring.
 *
 * Consequência: estes cenários provam o comportamento da UI (formulário →
 * requisição correta → reação correta na tela), **não** a integração real.
 * Em F01 a fase inteira fechou verde exatamente assim enquanto a tela
 * quebrava de verdade para o MANAGER contra o backend real
 * (memória `f01-frontend-only-not-e2e-verified`).
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
  id: "aaaaaaaa-0000-0000-0000-000000000001",
  name: "Cooperativa Serra Azul",
  taxId: "12345678000199",
  type: "COOP",
};

const COMMUNITY_A = {
  id: "bbbbbbbb-0000-0000-0000-00000000000a",
  name: "Comunidade Alto da Serra",
  organization: ORGANIZATION,
  createdAt: "2026-08-01T10:00:00Z",
  updatedAt: "2026-08-01T10:00:00Z",
};

const COMMUNITY_B = {
  id: "bbbbbbbb-0000-0000-0000-00000000000b",
  name: "Comunidade Vale do Sol",
  organization: ORGANIZATION,
  createdAt: "2026-08-01T10:05:00Z",
  updatedAt: "2026-08-01T10:05:00Z",
};

const MANAGER_USER: FakeUser = {
  id: "cccccccc-0000-0000-0000-000000000001",
  fullName: "Carlos Gestor",
  email: "carlos.manager@example.com",
  cpf: "11122233344",
  role: "MANAGER",
  dateOfBirth: "1985-02-20",
};

/**
 * `GET /managers/me` — RN1: o escopo do MANAGER falha fechado. Enquanto a
 * organização e as comunidades não resolverem, a listagem fica em skeleton.
 * Por isso esta rota é obrigatória em todo cenário de MANAGER.
 */
async function mockMyManager(page: Page) {
  await page.route("**/managers/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "dddddddd-0000-0000-0000-000000000001",
        user: {
          id: MANAGER_USER.id,
          fullName: MANAGER_USER.fullName,
          email: MANAGER_USER.email,
          cpf: MANAGER_USER.cpf,
          role: "MANAGER",
          dateOfBirth: MANAGER_USER.dateOfBirth,
        },
        organization: ORGANIZATION,
        createdAt: "2026-08-01T09:00:00Z",
        updatedAt: "2026-08-01T09:00:00Z",
      }),
    });
  });
}

test.describe("Produtores — cadastro e filtro por comunidade", () => {
  test("MANAGER cadastra um produtor vinculado a uma comunidade e ele aparece na listagem", async ({
    page,
  }) => {
    await loginAs(page, "MANAGER", MANAGER_USER);
    await mockMyManager(page);

    // Estado fabricado do "backend": o POST alimenta o GET seguinte.
    let producers: Record<string, unknown>[] = [];

    await page.route("**/communities*", async (route) => {
      if (route.request().method() !== "GET") {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([COMMUNITY_A, COMMUNITY_B]),
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
        body: JSON.stringify(producers),
      });
    });

    const producerName = "João da Mata";
    let registerUrl: string | null = null;
    let registerBody: Record<string, unknown> | null = null;

    // Rota mais específica registrada por último = maior prioridade no
    // Playwright. `POST /communities/{id}/producers` é o endpoint
    // hierárquico de `registerProducer()` — `POST /users/register` rejeita
    // `role: "PRODUCER"`.
    await page.route("**/communities/*/producers", async (route) => {
      const request = route.request();
      if (request.method() !== "POST") {
        await route.fallback();
        return;
      }
      registerUrl = request.url();
      registerBody = request.postDataJSON() as Record<string, unknown>;
      const created = {
        id: "eeeeeeee-0000-0000-0000-000000000001",
        aliasName: "Joãozinho",
        isCompliant: true,
        user: {
          id: "ffffffff-0000-0000-0000-000000000001",
          fullName: producerName,
          email: "joao.mata@example.com",
          cpf: "12345678909",
        },
        community: { id: COMMUNITY_A.id, name: COMMUNITY_A.name },
      };
      producers = [created];
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(created),
      });
    });

    await page.goto("/admin/produtores");

    await expect(
      page.getByText("Nenhum produtor cadastrado ainda."),
    ).toBeVisible();

    await page.getByRole("button", { name: "Novo Produtor" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByRole("combobox").click();
    await page.getByRole("option", { name: COMMUNITY_A.name }).click();

    await dialog.getByLabel("Nome completo").fill(producerName);
    await dialog.getByLabel("E-mail").fill("joao.mata@example.com");
    await dialog.getByLabel("Senha").fill("SenhaForte123");
    await dialog.getByLabel("CPF").fill("12345678909");
    await dialog.getByLabel("Data de nascimento").fill("1988-03-15");
    await dialog.getByLabel("Nome de exibição (opcional)").fill("Joãozinho");

    await dialog.getByRole("button", { name: "Cadastrar" }).click();

    // O diálogo NÃO fecha sozinho: mostra o painel de confirmação e só sai
    // de cena quando o usuário clica em "Fechar".
    await expect(dialog.getByRole("status")).toContainText(producerName);
    await expect(dialog.getByRole("status")).toContainText(COMMUNITY_A.name);

    expect(registerUrl).toContain(`/communities/${COMMUNITY_A.id}/producers`);
    expect(registerBody).toMatchObject({
      fullName: producerName,
      email: "joao.mata@example.com",
      dateOfBirth: "1988-03-15",
      aliasName: "Joãozinho",
    });

    await dialog.getByRole("button", { name: "Fechar" }).click();
    await expect(dialog).toBeHidden();

    await expect(page.getByRole("cell", { name: producerName })).toBeVisible();
    await expect(
      page.getByRole("cell", { name: COMMUNITY_A.name }),
    ).toBeVisible();
  });

  test("MANAGER filtra a listagem por comunidade e restaura com 'Todas as comunidades'", async ({
    page,
  }) => {
    await loginAs(page, "MANAGER", MANAGER_USER);
    await mockMyManager(page);

    await page.route("**/communities*", async (route) => {
      if (route.request().method() !== "GET") {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([COMMUNITY_A, COMMUNITY_B]),
      });
    });

    const producerA = {
      id: "eeeeeeee-0000-0000-0000-00000000000a",
      aliasName: null,
      isCompliant: true,
      user: {
        id: "ffffffff-0000-0000-0000-00000000000a",
        fullName: "Ana Serrana",
        email: "ana@example.com",
        cpf: "12345678909",
      },
      community: { id: COMMUNITY_A.id, name: COMMUNITY_A.name },
    };
    const producerB = {
      id: "eeeeeeee-0000-0000-0000-00000000000b",
      aliasName: null,
      isCompliant: false,
      user: {
        id: "ffffffff-0000-0000-0000-00000000000b",
        fullName: "Bruno do Vale",
        email: "bruno@example.com",
        cpf: "98765432100",
      },
      community: { id: COMMUNITY_B.id, name: COMMUNITY_B.name },
    };

    // `GET /producers` só aceita `?communityId=` — o backend fabricado
    // reproduz exatamente esse contrato.
    await page.route("**/producers*", async (route) => {
      const request = route.request();
      if (request.method() !== "GET") {
        await route.fallback();
        return;
      }
      const communityId = new URL(request.url()).searchParams.get(
        "communityId",
      );
      const all = [producerA, producerB];
      const body = communityId
        ? all.filter((item) => item.community.id === communityId)
        : all;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    });

    await page.goto("/admin/produtores");

    await expect(page.getByRole("cell", { name: "Ana Serrana" })).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "Bruno do Vale" }),
    ).toBeVisible();

    const filter = page.getByRole("combobox", { name: "Comunidade" });
    await filter.click();
    await page.getByRole("option", { name: COMMUNITY_A.name }).click();

    await expect(page.getByRole("cell", { name: "Ana Serrana" })).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "Bruno do Vale" }),
    ).toBeHidden();

    await filter.click();
    await page.getByRole("option", { name: "Todas as comunidades" }).click();

    await expect(page.getByRole("cell", { name: "Ana Serrana" })).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "Bruno do Vale" }),
    ).toBeVisible();
  });
});
