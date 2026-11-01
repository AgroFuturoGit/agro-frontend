// Gerado a partir do cenário em e2e/scenarios (fonte indicada abaixo); mantenha os dois em sincronia.
// Source: e2e/scenarios/E2E-015-cultura-edicao-simultanea.scenario.json
// Scenario: E2E-015 — ACs: AC-002, AC-005, AC-007 — requires @playwright/test >= 1.42
import { test, expect } from '@playwright/test';

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const data = {};
void data;

test.describe('E2E-015 Edição de cultura sem sobrescrever a de outra pessoa e com os limites do back', () => {
  test.use({ baseURL: process.env['E2E_BASE_URL'] });
  // Preconditions (arrange before running):
  //   - Backend develop (bfa3186 ou mais novo) rodando com as migrations aplicadas
  //   - Cultura 'Cultura E2E-015' cadastrada com todos os campos agronômicos
  //   - Gestor criado por POST /organizations/{id}/managers (admin)
  //   - Para a variante de conflito, o ambiente salva a mesma cultura por PATCH /crops/{id} durante a espera marcada no cenário (segunda sessão)

  test('happy_path — Admin edita o nome da cultura e a lista mostra o novo nome', {
    tag: ['@P0', '@culturas', '@concorrencia', '@limites'],
    annotation: [{ type: 'E2E', description: 'E2E-015' }, { type: 'AC', description: 'AC-002' }, { type: 'AC', description: 'AC-005' }, { type: 'AC', description: 'AC-007' }, { type: 'user', description: 'ADMIN' }],
  }, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(env('E2E_ADMIN_EMAIL'));
    await page.locator('#password').fill(env('E2E_ADMIN_PASSWORD'));
    await page.getByRole('button', { name: 'Entrar' }).click();
    // aguarda o redirecionamento pós-login
    await page.waitForURL(new RegExp(escapeRegExp('/admin')));
    await page.goto('/admin/culturas');
    await page.getByPlaceholder('Buscar por nome ou variedade…').fill('Cultura E2E-015');
    // debounce da busca da tabela
    await page.waitForTimeout(1200);
    await page.getByRole('button', { name: 'Editar cultura' }).click();
    await page.getByLabel('Nome da cultura').fill('Cultura E2E-015 B');
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    // o drawer fecha e a lista recarrega
    await page.waitForTimeout(1500);
    await page.getByPlaceholder('Buscar por nome ou variedade…').fill('Cultura E2E-015 B');
    // debounce da busca da tabela
    await page.waitForTimeout(1200);
    await expect(page.getByText('Cultura E2E-015 B')).toBeVisible();
  });

  test('conflito_409 — Outra pessoa salvou a cultura durante a edição: aviso de conflito e drawer aberto', {
    tag: ['@P0', '@culturas', '@concorrencia', '@limites'],
    annotation: [{ type: 'E2E', description: 'E2E-015' }, { type: 'AC', description: 'AC-002' }, { type: 'AC', description: 'AC-005' }, { type: 'AC', description: 'AC-007' }, { type: 'user', description: 'ADMIN' }],
  }, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(env('E2E_ADMIN_EMAIL'));
    await page.locator('#password').fill(env('E2E_ADMIN_PASSWORD'));
    await page.getByRole('button', { name: 'Entrar' }).click();
    // aguarda o redirecionamento pós-login
    await page.waitForURL(new RegExp(escapeRegExp('/admin')));
    await page.goto('/admin/culturas');
    await page.getByPlaceholder('Buscar por nome ou variedade…').fill('Cultura E2E-015');
    // debounce da busca da tabela
    await page.waitForTimeout(1200);
    await page.getByRole('button', { name: 'Editar cultura' }).click();
    // a segunda sessão salva a mesma cultura nesta janela
    await page.waitForTimeout(5000);
    await page.getByLabel('Variedade').fill('Variedade da primeira aba');
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(page.getByText('Esta cultura foi alterada por outra pessoa enquanto você editava.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Editar cultura' })).toBeVisible();
  });

  test('nome_acima_do_limite — Nome com 101 caracteres fica com 100', {
    tag: ['@P0', '@culturas', '@concorrencia', '@limites'],
    annotation: [{ type: 'E2E', description: 'E2E-015' }, { type: 'AC', description: 'AC-002' }, { type: 'AC', description: 'AC-005' }, { type: 'AC', description: 'AC-007' }, { type: 'user', description: 'ADMIN' }],
  }, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(env('E2E_ADMIN_EMAIL'));
    await page.locator('#password').fill(env('E2E_ADMIN_PASSWORD'));
    await page.getByRole('button', { name: 'Entrar' }).click();
    // aguarda o redirecionamento pós-login
    await page.waitForURL(new RegExp(escapeRegExp('/admin')));
    await page.goto('/admin/culturas');
    await page.getByRole('button', { name: 'Nova cultura' }).click();
    await page.getByLabel('Nome da cultura').fill('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
    await expect(page.getByLabel('Nome da cultura')).toHaveValue('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
  });

  test('gestor_sem_edicao — Gestor vê as culturas sem botões de criar ou editar', {
    tag: ['@P0', '@culturas', '@concorrencia', '@limites'],
    annotation: [{ type: 'E2E', description: 'E2E-015' }, { type: 'AC', description: 'AC-002' }, { type: 'AC', description: 'AC-005' }, { type: 'AC', description: 'AC-007' }, { type: 'user', description: 'MANAGER' }],
  }, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(env('E2E_MANAGER_EMAIL'));
    await page.locator('#password').fill(env('E2E_MANAGER_PASSWORD'));
    await page.getByRole('button', { name: 'Entrar' }).click();
    // aguarda o redirecionamento pós-login
    await page.waitForURL(new RegExp(escapeRegExp('/admin')));
    await page.goto('/admin/culturas');
    await page.getByPlaceholder('Buscar por nome ou variedade…').fill('Cultura E2E-015');
    // debounce da busca da tabela
    await page.waitForTimeout(1200);
    await expect(page.getByRole('button', { name: 'Nova cultura' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Editar cultura' })).toBeHidden();
  });
});
