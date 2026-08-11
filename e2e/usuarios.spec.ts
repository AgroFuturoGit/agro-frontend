import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * ⚠️ ESCOPO DESTE ARQUIVO — LEIA ANTES DE CONFIAR NO VERDE.
 *
 * A sessão aqui é FABRICADA (cookies `agro_token`/`agro_role` +
 * `localStorage["agro_user"]`) e a API é INTEIRAMENTE MOCKADA via
 * `page.route()` — mesmo padrão de `e2e/navegacao-cascata.spec.ts` e
 * `e2e/hierarchy.spec.ts`. Nenhuma requisição chega ao backend Spring.
 *
 * Cobre o fluxo `/admin/usuarios` sobre o `<DataTable>` genérico
 * (`usuarios-data-table`, plano 05, task 05-02): busca, filtro por papel,
 * ordenação, paginação e criação via drawer lateral.
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

/**
 * ~14 usuários fixture — pelo menos 2 de cada um dos 4 papéis, nomes que
 * permitem testar busca ("Zeca" é único) e ordenação alfabética de forma
 * inequívoca (primeiro/último em ordem alfabética conhecidos). Mais que o
 * `pageSize` padrão (10) para exercitar paginação.
 */
const USERS: FakeUser[] = [
  {
    id: "u-01",
    fullName: "Ana Beatriz Costa",
    email: "ana.costa@example.com",
    cpf: "10000000001",
    role: "ADMIN",
    dateOfBirth: "1990-01-15",
  },
  {
    id: "u-02",
    fullName: "Bruno Lima",
    email: "bruno.lima@example.com",
    cpf: "10000000002",
    role: "TECHNICIAN",
    dateOfBirth: "1988-05-20",
  },
  {
    id: "u-03",
    fullName: "Carla Dias",
    email: "carla.dias@example.com",
    cpf: "10000000003",
    role: "MANAGER",
    dateOfBirth: "1995-11-02",
  },
  {
    id: "u-04",
    fullName: "Diego Ferreira",
    email: "diego.ferreira@example.com",
    cpf: "10000000004",
    role: "PRODUCER",
    dateOfBirth: "1992-03-10",
  },
  {
    id: "u-05",
    fullName: "Elisa Martins",
    email: "elisa.martins@example.com",
    cpf: "10000000005",
    role: "ADMIN",
    dateOfBirth: "1991-07-22",
  },
  {
    id: "u-06",
    fullName: "Fábio Nogueira",
    email: "fabio.nogueira@example.com",
    cpf: "10000000006",
    role: "TECHNICIAN",
    dateOfBirth: "1987-09-05",
  },
  {
    id: "u-07",
    fullName: "Gabriela Rocha",
    email: "gabriela.rocha@example.com",
    cpf: "10000000007",
    role: "MANAGER",
    dateOfBirth: "1993-12-30",
  },
  {
    id: "u-08",
    fullName: "Hugo Santos",
    email: "hugo.santos@example.com",
    cpf: "10000000008",
    role: "PRODUCER",
    dateOfBirth: "1994-04-18",
  },
  {
    id: "u-09",
    fullName: "Isabela Tavares",
    email: "isabela.tavares@example.com",
    cpf: "10000000009",
    role: "TECHNICIAN",
    dateOfBirth: "1989-06-25",
  },
  {
    id: "u-10",
    fullName: "João Vieira",
    email: "joao.vieira@example.com",
    cpf: "10000000010",
    role: "MANAGER",
    dateOfBirth: "1996-08-14",
  },
  {
    id: "u-11",
    fullName: "Karina Xavier",
    email: "karina.xavier@example.com",
    cpf: "10000000011",
    role: "ADMIN",
    dateOfBirth: "1990-10-03",
  },
  {
    id: "u-12",
    fullName: "Luís Yamamoto",
    email: "luis.yamamoto@example.com",
    cpf: "10000000012",
    role: "PRODUCER",
    dateOfBirth: "1993-02-27",
  },
  {
    id: "u-13",
    fullName: "Mariana Zorzi",
    email: "mariana.zorzi@example.com",
    cpf: "10000000013",
    role: "TECHNICIAN",
    dateOfBirth: "1985-01-09",
  },
  {
    id: "u-14",
    fullName: "Zeca Almeida",
    email: "zeca.almeida@example.com",
    cpf: "10000000014",
    role: "ADMIN",
    dateOfBirth: "1997-05-19",
  },
];

async function mockUsersList(page: Page, users: FakeUser[] = USERS) {
  await page.route("**/users", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(users),
    });
  });
}

test.describe("/admin/usuarios — DataTable genérico", () => {
  test("busca livre filtra a lista por nome após o debounce", async ({ page }) => {
    await loginAs(page, "ADMIN", ADMIN_USER);
    await mockUsersList(page);

    await page.goto("/admin/usuarios");
    await expect(page.getByText("Ana Beatriz Costa")).toBeVisible();

    const search = page.getByPlaceholder("Buscar por nome, e-mail ou CPF…");
    await search.fill("Zeca");

    // Debounce de 500ms (`useDebouncedValue`) — espera baseada em conteúdo,
    // não um sleep arbitrário maior que o necessário.
    await expect(page.getByText("Zeca Almeida")).toBeVisible();
    await expect(page.getByText("Ana Beatriz Costa")).toHaveCount(0);
    await expect(page.getByText("Bruno Lima")).toHaveCount(0);
  });

  test("filtro por papel reduz a lista, ordenação por Nome reordena e paginação navega", async ({
    page,
  }) => {
    await loginAs(page, "ADMIN", ADMIN_USER);
    await mockUsersList(page);

    await page.goto("/admin/usuarios");
    await expect(page.getByText("Ana Beatriz Costa")).toBeVisible();

    // Filtro por papel — abre "Filtros", seleciona "Gerente" (MANAGER: Carla,
    // Gabriela, João — 3 usuários).
    await page.getByRole("button", { name: /Filtros/ }).click();
    await page.getByLabel("Papel").click();
    await page.getByRole("option", { name: "Gerente" }).click();

    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(3);
    await expect(page.getByText("Carla Dias")).toBeVisible();
    await expect(page.getByText("Gabriela Rocha")).toBeVisible();
    await expect(page.getByText("João Vieira")).toBeVisible();
    await expect(page.getByText("Ana Beatriz Costa")).toHaveCount(0);

    // Limpa o filtro de papel pelo chip removível para voltar aos 14 usuários.
    await page.getByRole("button", { name: /Papel: Gerente/ }).click();
    await expect(rows).toHaveCount(10); // pageSize padrão = 10, 14 usuários no total

    // Ordenação: clicar no header "Nome" ordena ascendente — primeira linha
    // vira "Ana Beatriz Costa" (já é o caso por padrão da API), reclicar
    // inverte para descendente e a primeira linha vira "Zeca Almeida".
    await page.getByRole("button", { name: "Nome" }).click();
    await expect(rows.first()).toContainText("Ana Beatriz Costa");
    await page.getByRole("button", { name: "Nome" }).click();
    await expect(rows.first()).toContainText("Zeca Almeida");

    // Paginação: 14 usuários > pageSize 10 → "Página 1 de 2", "Próxima
    // página" navega para a página 2.
    await expect(page.getByText("Página 1 de 2")).toBeVisible();
    await page.getByRole("button", { name: "Próxima página" }).click();
    await expect(page.getByText("Página 2 de 2")).toBeVisible();
    await expect(rows).toHaveCount(4);
  });

  test("criar usuário via drawer lateral: submeter fecha o drawer e a lista recarrega com o novo usuário", async ({
    page,
  }) => {
    await loginAs(page, "ADMIN", ADMIN_USER);
    await mockUsersList(page);

    const NEW_USER: FakeUser = {
      id: "u-new",
      fullName: "Novo Usuário Teste",
      email: "novo.usuario@example.com",
      cpf: "10000000099",
      role: "ADMIN",
      dateOfBirth: "2000-01-01",
    };

    await page.route("**/users/register", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(NEW_USER),
      });
    });

    await page.goto("/admin/usuarios");
    await expect(page.getByText("Ana Beatriz Costa")).toBeVisible();

    await page.getByRole("button", { name: "Novo usuário" }).click();

    const drawer = page.locator('[data-slot="sheet-content"]');
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveAttribute("data-side", "right");
    await expect(page.getByRole("heading", { name: "Novo usuário" })).toBeVisible();

    await page.getByLabel("Nome completo").fill(NEW_USER.fullName);
    await page.getByLabel("E-mail").fill(NEW_USER.email);
    await page.getByLabel("Senha").fill("senha1234");
    await page.getByLabel("CPF").fill(NEW_USER.cpf);
    await page.getByLabel("Data de nascimento").fill(NEW_USER.dateOfBirth as string);
    // Papel já vem "Administrador" (default `ADMIN` do formulário) —
    // corresponde ao papel do `NEW_USER`, nenhuma seleção extra necessária.

    // A lista recarregada (`GET /users` pós-criação) já inclui o novo
    // usuário — mock atualizado antes de submeter. Colocado no início do
    // array para garantir que apareça na página 1 (pageSize padrão = 10,
    // 15 usuários no total).
    await mockUsersList(page, [NEW_USER, ...USERS]);

    await page.getByRole("button", { name: "Cadastrar" }).click();

    await expect(drawer).toHaveCount(0);
    await expect(page.getByText(NEW_USER.fullName)).toBeVisible();
  });
});
