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

test("MANAGER acessa /admin/cultivos sem redirecionamento", async ({
  page,
}) => {
  await loginAs(page, "MANAGER");

  await page.goto("/admin/cultivos");

  await expect(page).toHaveURL(/\/admin\/cultivos/);
});

test("PRODUCER é redirecionado de /admin/perfis para /admin", async ({
  page,
}) => {
  await loginAs(page, "PRODUCER");

  await page.goto("/admin/perfis");

  await expect(page).toHaveURL(/\/admin$/);
});
