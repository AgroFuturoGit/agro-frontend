import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

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
 * Fabrica a sessão via cookies (decisão D5 de F01) — extraído/copiado do
 * helper `loginAs` de `e2e/rbac.spec.ts` sem alterar aquele arquivo.
 *
 * Extensão necessária para F02: F01 só exercita o proxy (middleware, que
 * lê apenas cookies) para validar redirecionamento. Aqui os componentes
 * client-side (`communities-page.tsx`) resolvem o papel do usuário via
 * `readUserFromStorage()` (`src/lib/auth.ts`), que lê
 * `localStorage["agro_user"]`, não o cookie. Por isso, quando um `user`
 * é informado, também populamos o localStorage via `page.addInitScript`
 * antes da navegação — continua sem login real via formulário.
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

/**
 * Decisão de implementação (Action 2 da Task 05-01):
 *
 * O cookie `agro_token` fabricado por `loginAs` não é um JWT real — ele
 * nunca foi emitido pelo backend. Qualquer chamada real a
 * `NEXT_PUBLIC_API_URL` (Spring Boot, `localhost:8080`) com esse token
 * retornaria 401, e sem um backend rodando o teste dependeria de infra
 * externa (quebrando o mesmo espírito determinístico da decisão D5 de
 * F01: sessão fabricada, sem login real, sem backend real).
 *
 * Por isso, cada cenário abaixo intercepta com `page.route()` só as
 * chamadas de API relevantes ao fluxo testado, respondendo com JSON
 * fabricado no shape exato dos DTOs documentados em spec.md §3
 * (`OrganizationResponseDTO`, `CommunityResponseDTO`,
 * `ManagerResponseDTO`, `UserResponseDTO`). Isso valida o comportamento
 * da UI (formulário → request correta → reação correta na tela), não a
 * integração real com o backend Spring — essa fica coberta pelo teste
 * manual T03 previsto no roadmap, que exige backend real rodando.
 */

test.describe("Hierarquia — Organização, Manager e Comunidade", () => {
  test("ADMIN cria uma Organização e depois cria um Manager para ela", async ({
    page,
  }) => {
    // `user` é obrigatório aqui: desde a navegação em cascata,
    // `organizations-page.tsx` gateia "Nova Organização"/"Editar"/"Criar
    // Manager" por role (`readUserFromStorage()`, populado via
    // `localStorage["agro_user"]`) — TECHNICIAN também alcança esta lista
    // agora e só ADMIN pode escrever (lição
    // `role-gating-must-cover-all-write-affordances`). Sem o `user` fabricado
    // aqui, `currentRole` nunca resolve e o botão não aparece.
    await loginAs(page, "ADMIN", {
      id: "admin-user-1",
      fullName: "Adriana Admin",
      email: "adriana.admin@example.com",
      cpf: "00011122233",
      role: "ADMIN",
      dateOfBirth: null,
    });

    const organizationId = "11111111-1111-1111-1111-111111111111";
    const organizationName = "Cooperativa Vale Verde";
    const organizationTaxId = "12345678000199";

    // Estado fabricado do "backend": GET /organizations reflete o que foi
    // criado via POST /organizations, sem depender de backend real.
    let organizations: Record<string, unknown>[] = [];

    await page.route("**/organizations*", async (route) => {
      const request = route.request();
      if (request.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(organizations),
        });
        return;
      }
      if (request.method() === "POST") {
        const created = {
          id: organizationId,
          name: organizationName,
          taxId: organizationTaxId,
          type: "COOP",
          createdAt: "2026-08-01T12:00:00Z",
          updatedAt: "2026-08-01T12:00:00Z",
        };
        organizations = [created];
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(created),
        });
        return;
      }
      await route.fallback();
    });

    const managerName = "Maria da Silva";

    await page.route("**/organizations/*/managers", async (route) => {
      if (route.request().method() !== "POST") {
        await route.fallback();
        return;
      }
      const managerResponse = {
        id: "22222222-2222-2222-2222-222222222222",
        user: {
          id: "33333333-3333-3333-3333-333333333333",
          fullName: managerName,
          email: "maria.manager@example.com",
          cpf: "98765432100",
          role: "MANAGER",
          dateOfBirth: "1990-05-10",
        },
        organization: {
          id: organizationId,
          name: organizationName,
          taxId: organizationTaxId,
          type: "COOP",
        },
        createdAt: "2026-08-01T12:05:00Z",
        updatedAt: "2026-08-01T12:05:00Z",
      };
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(managerResponse),
      });
    });

    await page.goto("/admin/organizacoes");

    await expect(
      page.getByText("Nenhuma organização cadastrada ainda."),
    ).toBeVisible();

    await page.getByRole("button", { name: "Nova Organização" }).click();

    const createDialog = page.getByRole("dialog");
    await expect(createDialog).toBeVisible();

    await createDialog.getByLabel("Nome").fill(organizationName);
    await createDialog.getByLabel("CNPJ").fill(organizationTaxId);
    await createDialog.getByRole("combobox", { name: "Tipo" }).click();
    await page.getByRole("option", { name: "Cooperativa" }).click();

    await createDialog.getByRole("button", { name: "Salvar" }).click();

    await expect(createDialog).toBeHidden();
    await expect(
      page.getByRole("cell", { name: organizationName }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Criar Manager" }).click();

    const managerDialog = page.getByRole("dialog");
    await expect(managerDialog).toBeVisible();

    await managerDialog.getByLabel("Nome completo").fill(managerName);
    await managerDialog
      .getByLabel("E-mail")
      .fill("maria.manager@example.com");
    await managerDialog.getByLabel("Senha").fill("SenhaForte123");
    await managerDialog.getByLabel("CPF").fill("98765432100");
    await managerDialog
      .getByLabel("Data de nascimento")
      .fill("1990-05-10");

    await managerDialog.getByRole("button", { name: "Cadastrar" }).click();

    await expect(managerDialog.getByRole("status")).toContainText(
      managerName,
    );
    await expect(
      managerDialog.getByText(
        `${managerName} foi cadastrado(a) como gestor(a) desta organização.`,
      ),
    ).toBeVisible();
  });

  test("MANAGER acessa /admin/organizacoes, é redirecionado para a própria organização e cria uma Comunidade sem ver seletor", async ({
    page,
  }) => {
    const myOrganization = {
      id: "44444444-4444-4444-4444-444444444444",
      name: "Associação Rio Claro",
      taxId: "98765432000188",
      type: "ASSOC",
    };

    const managerUser: FakeUser = {
      id: "55555555-5555-5555-5555-555555555555",
      fullName: "Carlos Gestor",
      email: "carlos.manager@example.com",
      cpf: "11122233344",
      role: "MANAGER",
      dateOfBirth: "1985-02-20",
    };

    await loginAs(page, "MANAGER", managerUser);

    await page.route("**/managers/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "66666666-6666-6666-6666-666666666666",
          user: {
            id: managerUser.id,
            fullName: managerUser.fullName,
            email: managerUser.email,
            cpf: managerUser.cpf,
            role: "MANAGER",
            dateOfBirth: managerUser.dateOfBirth,
          },
          organization: myOrganization,
          createdAt: "2026-08-01T09:00:00Z",
          updatedAt: "2026-08-01T09:00:00Z",
        }),
      });
    });

    // Estado fabricado do "backend" para GET /communities?orgId=...
    let communities: Record<string, unknown>[] = [];

    await page.route("**/communities*", async (route) => {
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

    const communityName = "Comunidade Rio Claro";

    // Rota mais específica (registrada por último = maior prioridade no
    // Playwright) para POST /organizations/{orgId}/communities — não deve
    // ser confundida com o GET de listagem acima.
    await page.route("**/organizations/*/communities", async (route) => {
      if (route.request().method() !== "POST") {
        await route.fallback();
        return;
      }
      const created = {
        id: "77777777-7777-7777-7777-777777777777",
        name: communityName,
        organization: myOrganization,
        createdAt: "2026-08-01T09:10:00Z",
        updatedAt: "2026-08-01T09:10:00Z",
      };
      communities = [created];
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(created),
      });
    });

    // `/admin/organizacoes` é o único ponto de entrada da hierarquia — o
    // MANAGER é redirecionado automaticamente para a própria organização,
    // sem nunca ver a lista completa (plano `navegacao-cascata-organizacoes`).
    await page.goto("/admin/organizacoes");
    await expect(page).toHaveURL(
      new RegExp(`/admin/organizacoes/${myOrganization.id}$`),
    );

    await expect(
      page.getByText("Nenhuma comunidade cadastrada nesta organização ainda."),
    ).toBeVisible();

    await page.getByRole("button", { name: "Nova Comunidade" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Rede de segurança E2E contra regressão do risco documentado em
    // `.planning/memory/lesson-backend-hierarchy-ownership.md`: o backend
    // não restringe MANAGER à própria organização, então a UI é a única
    // proteção — o MANAGER nunca pode ver/escolher outra organização.
    await expect(dialog.getByRole("combobox")).toHaveCount(0);
    await expect(dialog.getByText("Organização", { exact: true })).toHaveCount(
      0,
    );

    await dialog.getByLabel("Nome da comunidade").fill(communityName);
    await dialog.getByRole("button", { name: "Salvar" }).click();

    await expect(dialog).toBeHidden();
    await expect(
      page.getByRole("cell", { name: communityName }),
    ).toBeVisible();
  });
});
