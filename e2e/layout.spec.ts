import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * Layout, idioma e acessibilidade (E2E mockado): a sessão é fabricada
 * (cookies + localStorage) e a API é interceptada com `page.route()`;
 * nenhuma requisição chega ao backend.
 */

const ADMIN = {
  id: "admin-user-1",
  fullName: "Adriana Admin",
  email: "adriana@example.com",
  cpf: "00011122233",
  role: "ADMIN",
  dateOfBirth: null,
};

const LIST_PATHS = ["/admin/safras", "/admin/usuarios", "/admin/organizacoes", "/admin/perfis", "/admin"];

async function loginAsAdmin(page: Page) {
  await page.context().addCookies([
    { name: "agro_token", value: "e2e-fake-token", url: "http://localhost:3000" },
    { name: "agro_role", value: "ADMIN", url: "http://localhost:3000" },
  ]);
  await page.addInitScript(
    ({ key, value }) => window.localStorage.setItem(key, value),
    { key: "agro_user", value: JSON.stringify(ADMIN) },
  );
  await page.route(/localhost:8080\//, async (route) => {
    const url = route.request().url();
    if (url.includes("/auth/me")) {
      await route.fulfill({ status: 200, json: ADMIN });
    } else if (url.includes("/roles")) {
      await route.fulfill({
        status: 200,
        json: [{ name: "ADMIN", description: "Administrador do sistema" }],
      });
    } else if (url.includes("/users")) {
      await route.fulfill({
        status: 200,
        json: [
          { id: "u1", fullName: "Ana Souza", email: "ana@example.com", cpf: "11122233344", role: "ADMIN" },
          { id: "u2", fullName: "Bruno Lima", email: "bruno@example.com", cpf: "22233344455", role: "TECHNICIAN" },
        ],
      });
    } else {
      await route.fulfill({ status: 200, json: [] });
    }
  });
}

test.describe("Layout responsivo", () => {
  for (const width of [375, 768, 1366]) {
    test(`sem rolagem horizontal e com menu do usuário visível em ${width}px`, async ({ page }) => {
      await loginAsAdmin(page);
      await page.setViewportSize({ width, height: 800 });

      for (const path of LIST_PATHS) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(overflow, `${path} em ${width}px`).toBeLessThanOrEqual(0);
        // O nome fica oculto abaixo de 640px (só o avatar aparece).
        if (width >= 768) {
          await expect(page.getByText("Adriana Admin").first()).toBeVisible();
        }
      }
    });
  }

  test("no celular, clicar num item do menu fecha o menu", async ({ page }) => {
    await loginAsAdmin(page);
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/admin");

    await page.getByRole("button", { name: "Alternar menu lateral" }).click();
    const menu = page.getByRole("dialog");
    await expect(menu).toBeVisible();

    await menu.getByRole("link", { name: "Safras" }).click();
    await expect(page).toHaveURL(/\/admin\/safras/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("Usuários mostra cartões no celular", async ({ page }) => {
    await loginAsAdmin(page);
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/admin/usuarios");

    await expect(page.getByText("ana@example.com")).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Editar usuário" })).toHaveCount(2);
  });
});

test.describe("Idioma, 404 e acessibilidade", () => {
  test("título, idioma e manifest", async ({ page, request }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle(/ProduPlan/);
    await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");

    const response = await request.get("/manifest.webmanifest");
    expect(response.status()).toBe(200);
    expect((await response.json()).name).toBe("ProduPlan");
  });

  test("rota inexistente mostra a 404 em português", async ({ page }) => {
    await page.goto("/rota-que-nao-existe");
    await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Voltar ao início" })).toBeVisible();
  });

  test("um único <main> e link 'Pular para o conteúdo' como primeiro foco", async ({ page }) => {
    await loginAsAdmin(page);
    await page.setViewportSize({ width: 1366, height: 800 });
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("main")).toHaveCount(1);

    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Pular para o conteúdo" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#conteudo-principal$/);
    await expect(page.locator("main#conteudo-principal")).toBeFocused();
  });
});
