import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * ⚠️ ESCOPO DESTE ARQUIVO — LEIA ANTES DE CONFIAR NO VERDE.
 *
 * A sessão aqui é FABRICADA (cookies `agro_token`/`agro_role` +
 * `localStorage["agro_user"]`) e a API é INTEIRAMENTE MOCKADA via
 * `page.route()` — mesmo padrão de `e2e/usuarios.spec.ts`. Nenhuma
 * requisição chega ao backend Spring.
 *
 * Cobre `/admin/culturas` e `/admin/safras` migradas para o `DataTable`
 * genérico: busca, ordenação, paginação, criação, exclusão (Culturas ganhou
 * a ação que faltava) e o layout de cards em viewport mobile.
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

async function loginAs(page: Page, role: string, user: FakeUser) {
  await page.context().addCookies([
    { name: AUTH_TOKEN_COOKIE, value: "e2e-fake-token", url: "http://localhost:3000" },
    { name: AUTH_ROLE_COOKIE, value: role, url: "http://localhost:3000" },
  ]);

  await page.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, value);
    },
    { key: AUTH_USER_STORAGE_KEY, value: JSON.stringify(user) },
  );
}

const ADMIN_USER: FakeUser = {
  id: "admin-user-1",
  fullName: "Adriana Admin",
  email: "adriana@example.com",
  cpf: "00011122233",
  role: "ADMIN",
  dateOfBirth: null,
};

type FakeCrop = {
  id: string;
  name: string;
  variety: string;
  isPriority: boolean;
};

/**
 * 12 culturas — mais que o `pageSize` padrão (10), para exercitar
 * paginação. "Abacaxi" e "Uva" garantem extremos alfabéticos inequívocos
 * para o teste de ordenação; "Trigo" é único o bastante para a busca.
 */
const CROPS: FakeCrop[] = [
  { id: "crop-01", name: "Abacaxi", variety: "Pérola", isPriority: false },
  { id: "crop-02", name: "Banana", variety: "Prata", isPriority: false },
  { id: "crop-03", name: "Cana-de-açúcar", variety: "Roxa", isPriority: false },
  { id: "crop-04", name: "Feijão", variety: "Preto", isPriority: false },
  { id: "crop-05", name: "Girassol", variety: "Comum", isPriority: false },
  { id: "crop-06", name: "Laranja", variety: "Pera", isPriority: false },
  { id: "crop-07", name: "Mandioca", variety: "Doce", isPriority: false },
  { id: "crop-08", name: "Milho", variety: "Transgênico", isPriority: true },
  { id: "crop-09", name: "Pimentão", variety: "Verde", isPriority: false },
  { id: "crop-10", name: "Soja", variety: "Convencional", isPriority: true },
  { id: "crop-11", name: "Trigo", variety: "Precoce", isPriority: false },
  { id: "crop-12", name: "Uva", variety: "Niágara", isPriority: false },
];

type FakeHarvest = {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
};

/** 12 safras, rótulos com extremos alfabéticos conhecidos ("Safra 2015..." / "Safrinha 2026"). */
const HARVESTS: FakeHarvest[] = [
  { id: "h-01", label: "Safra 2015/2016", startDate: "2015-09-01", endDate: "2016-03-31" },
  { id: "h-02", label: "Safra 2016/2017", startDate: "2016-09-01", endDate: "2017-03-31" },
  { id: "h-03", label: "Safra 2017/2018", startDate: "2017-09-01", endDate: "2018-03-31" },
  { id: "h-04", label: "Safra 2018/2019", startDate: "2018-09-01", endDate: "2019-03-31" },
  { id: "h-05", label: "Safra 2019/2020", startDate: "2019-09-01", endDate: "2020-03-31" },
  { id: "h-06", label: "Safra 2020/2021", startDate: "2020-09-01", endDate: "2021-03-31" },
  { id: "h-07", label: "Safra 2021/2022", startDate: "2021-09-01", endDate: "2022-03-31" },
  { id: "h-08", label: "Safra 2022/2023", startDate: "2022-09-01", endDate: "2023-03-31" },
  { id: "h-09", label: "Safra 2023/2024", startDate: "2023-09-01", endDate: "2024-03-31" },
  { id: "h-10", label: "Safra 2024/2025", startDate: "2024-09-01", endDate: "2025-03-31" },
  { id: "h-11", label: "Safra 2025/2026", startDate: "2025-09-01", endDate: "2026-03-31" },
  { id: "h-12", label: "Safrinha 2026", startDate: "2026-02-01", endDate: "2026-06-30" },
];

async function mockCropsList(page: Page, crops: FakeCrop[] = CROPS) {
  await page.route("**/crops", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(crops),
    });
  });
}

async function mockHarvestsList(page: Page, harvests: FakeHarvest[] = HARVESTS) {
  await page.route("**/harvests", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(harvests),
    });
  });
}

test.describe("/admin/culturas — DataTable genérico", () => {
  test("busca livre filtra a lista por nome após o debounce", async ({ page }) => {
    await loginAs(page, "ADMIN", ADMIN_USER);
    await mockCropsList(page);

    await page.goto("/admin/culturas");
    await expect(page.getByText("Abacaxi")).toBeVisible();

    const search = page.getByPlaceholder("Buscar por nome ou variedade…");
    await search.fill("Trigo");

    // `{ exact: true }` evita colidir com o chip "Busca: Trigo" da
    // toolbar, que também contém a substring "Trigo".
    await expect(page.getByText("Trigo", { exact: true })).toBeVisible();
    await expect(page.getByText("Abacaxi")).toHaveCount(0);
    await expect(page.getByText("Soja")).toHaveCount(0);
  });

  test("ordenação por Nome reordena e paginação navega", async ({ page }) => {
    await loginAs(page, "ADMIN", ADMIN_USER);
    await mockCropsList(page);

    await page.goto("/admin/culturas");
    await expect(page.getByText("Abacaxi")).toBeVisible();

    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(10); // pageSize padrão = 10, 12 culturas no total

    await page.getByRole("button", { name: "Nome" }).click();
    await expect(rows.first()).toContainText("Abacaxi");
    await page.getByRole("button", { name: "Nome" }).click();
    await expect(rows.first()).toContainText("Uva");

    await expect(page.getByText("Página 1 de 2")).toBeVisible();
    await page.getByRole("button", { name: "Próxima página" }).click();
    await expect(page.getByText("Página 2 de 2")).toBeVisible();
    await expect(rows).toHaveCount(2);
  });

  test("criar cultura via dialog: submeter fecha o formulário e a lista recarrega com a nova cultura", async ({
    page,
  }) => {
    await loginAs(page, "ADMIN", ADMIN_USER);
    await mockCropsList(page);

    const NEW_CROP: FakeCrop = {
      id: "crop-new",
      name: "Sorgo",
      variety: "Granífero",
      isPriority: false,
    };

    await page.route("**/crops/register", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(NEW_CROP),
      });
    });

    await page.goto("/admin/culturas");
    await expect(page.getByText("Abacaxi")).toBeVisible();

    await page.getByRole("button", { name: "Nova cultura" }).click();
    await expect(page.getByRole("heading", { name: "Nova cultura" })).toBeVisible();

    await page.getByLabel("Nome da cultura").fill(NEW_CROP.name);
    await page.getByLabel("Variedade").fill(NEW_CROP.variety);

    // Lista recarregada (`GET /crops` pós-criação) já inclui a nova
    // cultura — mock atualizado antes de submeter, no início do array para
    // garantir que apareça na página 1.
    await mockCropsList(page, [NEW_CROP, ...CROPS]);

    await page.getByRole("button", { name: "Salvar" }).click();

    await expect(page.getByRole("heading", { name: "Nova cultura" })).toHaveCount(0);
    await expect(page.getByText(NEW_CROP.name)).toBeVisible();
  });

  test("excluir cultura pede confirmação e some da lista", async ({ page }) => {
    await loginAs(page, "ADMIN", ADMIN_USER);
    await mockCropsList(page);

    // "Milho" (índice 7) cai na página 1 (pageSize 10) — uma linha de ação
    // só é alcançável se a linha estiver renderizada.
    await page.route("**/crops/crop-08", async (route) => {
      if (route.request().method() !== "DELETE") {
        await route.fallback();
        return;
      }
      await route.fulfill({ status: 204 });
    });

    await page.goto("/admin/culturas");
    await expect(page.getByText("Milho")).toBeVisible();

    const milhoRow = page.locator("table tbody tr", { hasText: "Milho" });
    await milhoRow.getByRole("button", { name: "Excluir cultura" }).click();

    await expect(page.getByRole("heading", { name: "Excluir cultura" })).toBeVisible();
    await expect(page.getByText(/removerá.*Milho.*do sistema/)).toBeVisible();

    // Lista recarregada (`GET /crops` pós-exclusão) sem a cultura removida.
    await mockCropsList(
      page,
      CROPS.filter((c) => c.id !== "crop-08"),
    );

    await page.getByRole("button", { name: "Excluir", exact: true }).click();

    await expect(page.getByRole("heading", { name: "Excluir cultura" })).toHaveCount(0);
    await expect(page.getByText("Milho")).toHaveCount(0);
  });

  test.describe("viewport mobile", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("renderiza cards em vez de tabela, com as ações de linha alcançáveis", async ({
      page,
    }) => {
      await loginAs(page, "ADMIN", ADMIN_USER);
      await mockCropsList(page);

      await page.goto("/admin/culturas");
      await expect(page.getByText("Abacaxi")).toBeVisible();

      await expect(page.locator("table")).toHaveCount(0);

      // Sobe do parágrafo do nome (`min-w-0 flex-1`) até o container que
      // também é pai das ações — dois níveis, mesma estrutura de
      // `renderMobileCard` em `crops-page.tsx`.
      const abacaxiName = page.getByText("Abacaxi — Pérola", { exact: true });
      const abacaxiCard = abacaxiName.locator("..").locator("..");
      await expect(abacaxiCard.getByRole("button", { name: "Editar" })).toBeVisible();
      await expect(
        abacaxiCard.getByRole("button", { name: "Excluir cultura" }),
      ).toBeVisible();
    });
  });
});

test.describe("/admin/safras — DataTable genérico", () => {
  test("busca livre filtra a lista por rótulo após o debounce", async ({ page }) => {
    await loginAs(page, "ADMIN", ADMIN_USER);
    await mockHarvestsList(page);

    await page.goto("/admin/safras");
    await expect(page.getByText("Safra 2015/2016")).toBeVisible();

    const search = page.getByPlaceholder("Buscar por rótulo…");
    await search.fill("Safrinha");

    await expect(page.getByText("Safrinha 2026")).toBeVisible();
    await expect(page.getByText("Safra 2015/2016")).toHaveCount(0);
  });

  test("ordenação por Rótulo reordena e paginação navega", async ({ page }) => {
    await loginAs(page, "ADMIN", ADMIN_USER);
    await mockHarvestsList(page);

    await page.goto("/admin/safras");
    await expect(page.getByText("Safra 2015/2016")).toBeVisible();

    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(10); // pageSize padrão = 10, 12 safras no total

    await page.getByRole("button", { name: "Rótulo" }).click();
    await expect(rows.first()).toContainText("Safra 2015/2016");
    await page.getByRole("button", { name: "Rótulo" }).click();
    await expect(rows.first()).toContainText("Safrinha 2026");

    await expect(page.getByText("Página 1 de 2")).toBeVisible();
    await page.getByRole("button", { name: "Próxima página" }).click();
    await expect(page.getByText("Página 2 de 2")).toBeVisible();
    await expect(rows).toHaveCount(2);
  });

  test.describe("viewport mobile", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("renderiza cards em vez de tabela, com as ações de linha alcançáveis", async ({
      page,
    }) => {
      await loginAs(page, "ADMIN", ADMIN_USER);
      await mockHarvestsList(page);

      await page.goto("/admin/safras");
      await expect(page.getByText("Safra 2015/2016")).toBeVisible();

      await expect(page.locator("table")).toHaveCount(0);

      // Sobe do parágrafo do rótulo (`min-w-0 flex-1`) até o container que
      // também é pai das ações — mesma estrutura de `renderMobileCard` em
      // `harvests-page.tsx`.
      const label = page.getByText("Safra 2015/2016", { exact: true });
      const card = label.locator("..").locator("..");
      await expect(card.getByRole("button", { name: "Editar safra" })).toBeVisible();
      await expect(card.getByRole("button", { name: "Excluir safra" })).toBeVisible();
    });
  });
});
