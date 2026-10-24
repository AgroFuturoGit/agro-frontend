// Gerado a partir do cenário em e2e/scenarios (fonte indicada abaixo); mantenha os dois em sincronia.
// Source: e2e/scenarios/E2E-012-ocorrencias-apontamento.scenario.json
// Scenario: E2E-012 — ACs: AC-010 — requires @playwright/test >= 1.42
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

test.describe('E2E-012 Ocorrências de campo do apontamento', () => {
  test.use({ baseURL: process.env['E2E_BASE_URL'] });
  // Preconditions (arrange before running):
  //   - Backend develop rodando com as migrations aplicadas
  //   - Agricultor com plano e um apontamento; caminho do detalhe do plano em E2E_PLAN_PATH; gestor da organização do agricultor em E2E_MANAGER_*
  //   - Apontamento com a ocorrência 'Ocorrência Semente' (evento climático) criada pela API, para a leitura do gestor

  test('happy_path — Agricultor registra uma ocorrência de praga com link de evidência e a exclui', {
    tag: ['@P0', '@producao', '@ocorrencias', '@apontamento'],
    annotation: [{ type: 'E2E', description: 'E2E-012' }, { type: 'AC', description: 'AC-010' }, { type: 'user', description: 'FARMER' }],
  }, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(env('E2E_FARMER_EMAIL'));
    await page.locator('#password').fill(env('E2E_FARMER_PASSWORD'));
    await page.getByRole('button', { name: 'Entrar' }).click();
    // aguarda o redirecionamento pós-login
    await page.waitForURL(new RegExp(escapeRegExp('/admin')));
    await page.goto(env('E2E_PLAN_PATH'));
    await page.getByRole('button', { name: 'Ocorrências do apontamento', exact: true }).click();
    await page.getByRole('button', { name: 'Adicionar ocorrência', exact: true }).click();
    await page.getByLabel('Tipo', { exact: true }).selectOption('PEST');
    await page.getByLabel('Descrição', { exact: true }).fill('Lagarta do cartucho E2E');
    await page.getByLabel('Observação climática (opcional)', { exact: true }).fill('Sol forte');
    await page.getByLabel('Link da evidência (opcional)', { exact: true }).fill('https://exemplo.test/evidencia-e2e.jpg');
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(page.getByText('Lagarta do cartucho E2E')).toBeVisible();
    await expect(page.locator('a[href=\'https://exemplo.test/evidencia-e2e.jpg\'][rel=\'noopener noreferrer\']')).toBeVisible();
    await page.getByRole('button', { name: 'Excluir ocorrência Praga', exact: true }).click();
    await page.locator('[role=alertdialog] button:has-text(\'Excluir\')').click();
    await expect(page.getByText('Ocorrência Semente')).toBeVisible();
    await expect(page.getByRole('alertdialog', { name: 'Excluir ocorrência' })).toBeHidden();
    await expect(page.getByText('Lagarta do cartucho E2E')).toBeHidden();
    await expect(page.getByText('Ocorrência Semente')).toBeVisible();
  });

  test('validation_error — Agricultor tenta salvar sem tipo e sem descrição e vê os erros por campo', {
    tag: ['@P0', '@producao', '@ocorrencias', '@apontamento'],
    annotation: [{ type: 'E2E', description: 'E2E-012' }, { type: 'AC', description: 'AC-010' }, { type: 'user', description: 'FARMER' }],
  }, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(env('E2E_FARMER_EMAIL'));
    await page.locator('#password').fill(env('E2E_FARMER_PASSWORD'));
    await page.getByRole('button', { name: 'Entrar' }).click();
    // aguarda o redirecionamento pós-login
    await page.waitForURL(new RegExp(escapeRegExp('/admin')));
    await page.goto(env('E2E_PLAN_PATH'));
    await page.getByRole('button', { name: 'Ocorrências do apontamento', exact: true }).click();
    await page.getByRole('button', { name: 'Adicionar ocorrência', exact: true }).click();
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(page.getByText('O tipo de ocorrência é obrigatório')).toBeVisible();
    await expect(page.getByText('A descrição é obrigatória')).toBeVisible();
  });

  test('manager_readonly — Gestor vê as ocorrências do apontamento sem nenhuma ação de escrita', {
    tag: ['@P0', '@producao', '@ocorrencias', '@apontamento'],
    annotation: [{ type: 'E2E', description: 'E2E-012' }, { type: 'AC', description: 'AC-010' }, { type: 'user', description: 'MANAGER' }],
  }, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(env('E2E_MANAGER_EMAIL'));
    await page.locator('#password').fill(env('E2E_MANAGER_PASSWORD'));
    await page.getByRole('button', { name: 'Entrar' }).click();
    // aguarda o redirecionamento pós-login
    await page.waitForURL(new RegExp(escapeRegExp('/admin')));
    await page.goto(env('E2E_PLAN_PATH'));
    await page.getByRole('button', { name: 'Ocorrências do apontamento', exact: true }).click();
    await expect(page.getByText('Ocorrência Semente')).toBeVisible();
    await expect(page.getByText('Ocorrência Semente')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Adicionar ocorrência', exact: true })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Editar ocorrência Evento climático', exact: true })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Excluir ocorrência Evento climático', exact: true })).toBeHidden();
  });
});
