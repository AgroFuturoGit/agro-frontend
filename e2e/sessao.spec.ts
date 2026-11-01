import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * Sessão inválida (E2E mockado): a API é interceptada com `page.route()`.
 * O back real responde 500 para token inválido e 403 para permissão negada,
 * então o front confere a sessão com `GET /auth/me` antes de encerrá-la.
 */

const ADMIN = {
  id: "00000000-0000-0000-0000-000000000001",
  fullName: "Admin E2E",
  email: "admin@example.com",
  cpf: "12345678909",
  role: "ADMIN",
};

async function seedSession(page: Page) {
  await page.context().addCookies([
    { name: "agro_token", value: "token-vencido", url: "http://localhost:3000" },
    { name: "agro_role", value: "ADMIN", url: "http://localhost:3000" },
  ]);
}

test("token inválido em /admin/usuarios leva ao login com from e volta depois de entrar", async ({
  page,
}) => {
  await seedSession(page);
  let loggedIn = false;

  await page.route("**/auth/me", async (route) => {
    if (loggedIn) {
      await route.fulfill({ status: 200, json: ADMIN });
    } else {
      await route.fulfill({ status: 500, json: { message: "Token inválido" } });
    }
  });
  await page.route("**/users*", async (route) => {
    if (loggedIn) {
      await route.fulfill({
        status: 200,
        json: { content: [], totalElements: 0, totalPages: 0, number: 0, size: 10 },
      });
    } else {
      await route.fulfill({ status: 500, json: { message: "Token inválido" } });
    }
  });
  await page.route("**/auth/login", async (route) => {
    loggedIn = true;
    await route.fulfill({
      status: 200,
      json: { token: "token-novo", userResponseDTO: { ...ADMIN, dateOfBirth: null } },
    });
  });

  await page.goto("/admin/usuarios");

  await expect(page).toHaveURL(/\/login\?from=%2Fadmin%2Fusuarios/);

  await page.waitForLoadState("networkidle");
  await page.getByLabel("E-mail").fill("admin@example.com");
  await page.locator("#password").fill("senha-e2e-123");
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page).toHaveURL(/\/admin\/usuarios$/);
});

test("/login com token inválido abre o formulário", async ({ page }) => {
  await seedSession(page);

  await page.goto("/login");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
});
