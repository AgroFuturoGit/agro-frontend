// Gerado a partir do cenário em e2e/scenarios (fonte indicada abaixo); mantenha os dois em sincronia.
// Source: e2e/scenarios/E2E-010-dashboard-gestao.scenario.json
// Scenario: E2E-010 — ACs: AC-009, AC-010 — requires @playwright/test >= 1.42
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

test.describe('E2E-010 Dashboard macro-gerencial do gestor e do administrador', () => {
  test.use({ baseURL: process.env['E2E_BASE_URL'] });
  // Preconditions (arrange before running):
  //   - Backend develop rodando com as migrations aplicadas
  //   - Gestor criado por POST /organizations/{id}/managers (admin) para uma organização com comunidades, agricultores e planos na safra vigente
  //   - Ao menos duas organizações com planos, para o comparativo do admin
  //   - Nomes em E2E_MANAGER_ORG (organização do gestor), E2E_ADMIN_ORG (organização a filtrar), E2E_ADMIN_OTHER_ORG (outra organização, some do comparativo ao filtrar) e E2E_ADMIN_COMMUNITY (comunidade de E2E_ADMIN_ORG com plano)

  test('happy_path — Gestor vê a sua organização: métricas, ranking, participação e comunidades', {
    tag: ['@P0', '@painel', '@gestao', '@analytics'],
    annotation: [{ type: 'E2E', description: 'E2E-010' }, { type: 'AC', description: 'AC-009' }, { type: 'AC', description: 'AC-010' }, { type: 'user', description: 'MANAGER' }],
  }, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(env('E2E_MANAGER_EMAIL'));
    await page.locator('#password').fill(env('E2E_MANAGER_PASSWORD'));
    await page.getByRole('button', { name: 'Entrar' }).click();
    // aguarda o redirecionamento pós-login
    await page.waitForURL(new RegExp(escapeRegExp('/admin')));
    await page.goto('/admin');
    await expect(page.getByText(env('E2E_MANAGER_ORG'))).toBeVisible();
    await expect(page.getByText('Volume previsto')).toBeVisible();
    await expect(page.getByText('Taxa de conversão')).toBeVisible();
    await expect(page.getByTestId('crop-ranking')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Participação por cultura' })).toBeVisible();
    await expect(page.getByTestId('management-community-chart')).toBeVisible();
    await expect(page.getByTestId('communities-table')).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Organização' })).toBeHidden();
  });

  test('admin_global_filtra — Admin vê o global e filtra por organização e comunidade', {
    tag: ['@P0', '@painel', '@gestao', '@analytics'],
    annotation: [{ type: 'E2E', description: 'E2E-010' }, { type: 'AC', description: 'AC-009' }, { type: 'AC', description: 'AC-010' }, { type: 'user', description: 'ADMIN' }],
  }, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(env('E2E_ADMIN_EMAIL'));
    await page.locator('#password').fill(env('E2E_ADMIN_PASSWORD'));
    await page.getByRole('button', { name: 'Entrar' }).click();
    // aguarda o redirecionamento pós-login
    await page.waitForURL(new RegExp(escapeRegExp('/admin')));
    await page.goto('/admin');
    await expect(page.getByTestId('organizations-table')).toBeVisible();
    await page.getByRole('combobox', { name: 'Organização' }).click();
    await page.getByRole('option', { name: env('E2E_ADMIN_ORG') }).click();
    await expect(page.locator('[data-testid=\'mgmt-scope-title\']')).toBeVisible();
    await page.getByRole('combobox', { name: 'Comunidade' }).click();
    await page.getByRole('option', { name: env('E2E_ADMIN_COMMUNITY') }).click();
    await expect(page.getByTestId('mgmt-scope-title')).toBeVisible();
    await expect(page.getByRole('cell', { name: env('E2E_ADMIN_COMMUNITY') })).toBeVisible();
    await expect(page.getByRole('cell', { name: env('E2E_ADMIN_OTHER_ORG') })).toBeHidden();
  });

  test('admin_ve_comparativo — Admin sem filtro vê o global e o comparativo entre organizações', {
    tag: ['@P0', '@painel', '@gestao', '@analytics'],
    annotation: [{ type: 'E2E', description: 'E2E-010' }, { type: 'AC', description: 'AC-009' }, { type: 'AC', description: 'AC-010' }, { type: 'user', description: 'ADMIN' }],
  }, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(env('E2E_ADMIN_EMAIL'));
    await page.locator('#password').fill(env('E2E_ADMIN_PASSWORD'));
    await page.getByRole('button', { name: 'Entrar' }).click();
    // aguarda o redirecionamento pós-login
    await page.waitForURL(new RegExp(escapeRegExp('/admin')));
    await page.goto('/admin');
    await expect(page.getByText('Todas as organizações')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Comparativo entre organizações' })).toBeVisible();
    await expect(page.getByTestId('organizations-table')).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Organização' })).toBeVisible();
  });

  test('forbidden — Gestor não tem filtro de organização nem comparativo entre organizações', {
    tag: ['@P0', '@painel', '@gestao', '@analytics'],
    annotation: [{ type: 'E2E', description: 'E2E-010' }, { type: 'AC', description: 'AC-009' }, { type: 'AC', description: 'AC-010' }, { type: 'user', description: 'MANAGER' }],
  }, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(env('E2E_MANAGER_EMAIL'));
    await page.locator('#password').fill(env('E2E_MANAGER_PASSWORD'));
    await page.getByRole('button', { name: 'Entrar' }).click();
    // aguarda o redirecionamento pós-login
    await page.waitForURL(new RegExp(escapeRegExp('/admin')));
    await page.goto('/admin');
    await expect(page.getByTestId('communities-table')).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Organização' })).toBeHidden();
    await expect(page.getByTestId('organizations-table')).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Comparativo entre organizações' })).toBeHidden();
  });
});
