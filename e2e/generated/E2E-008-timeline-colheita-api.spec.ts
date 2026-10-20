// Gerado a partir do cenário em e2e/scenarios (fonte indicada abaixo); mantenha os dois em sincronia.
// Source: e2e/scenarios/E2E-008-timeline-colheita-api.scenario.json
// Scenario: E2E-008 — ACs: AC-011 — requires @playwright/test >= 1.42
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

test.describe('E2E-008 Gráfico de colheita pelo endpoint de timeline', () => {
  test.use({ baseURL: process.env['E2E_BASE_URL'] });
  // Preconditions (arrange before running):
  //   - Backend develop rodando com as migrations aplicadas
  //   - Plano CONTINUOUS do agricultor com janela de colheita e apontamentos; URL do plano em E2E_FARMER_PLAN_PATH

  test('happy_path — Gráfico abre em semana e alterna para mês', {
    tag: ['@P0', '@grafico', '@timeline', '@analytics'],
    annotation: [{ type: 'E2E', description: 'E2E-008' }, { type: 'AC', description: 'AC-011' }, { type: 'user', description: 'FARMER' }],
  }, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(env('E2E_FARMER_EMAIL'));
    await page.locator('#password').fill(env('E2E_FARMER_PASSWORD'));
    await page.getByRole('button', { name: 'Entrar' }).click();
    // aguarda o redirecionamento pós-login
    await page.waitForURL(new RegExp(escapeRegExp('/admin')));
    await page.goto(env('E2E_FARMER_PLAN_PATH'));
    await expect(page.getByText('Colheita por semana, em kg.')).toBeVisible();
    await expect(page.getByText('Somente validados contam no realizado oficial.')).toBeVisible();
  });

  test('mes — Alternar para mês refaz o gráfico', {
    tag: ['@P0', '@grafico', '@timeline', '@analytics'],
    annotation: [{ type: 'E2E', description: 'E2E-008' }, { type: 'AC', description: 'AC-011' }, { type: 'user', description: 'FARMER' }],
  }, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(env('E2E_FARMER_EMAIL'));
    await page.locator('#password').fill(env('E2E_FARMER_PASSWORD'));
    await page.getByRole('button', { name: 'Entrar' }).click();
    // aguarda o redirecionamento pós-login
    await page.waitForURL(new RegExp(escapeRegExp('/admin')));
    await page.goto(env('E2E_FARMER_PLAN_PATH'));
    await page.getByRole('button', { name: 'Mês' }).click();
    await expect(page.getByText('Colheita por mês, em kg.')).toBeVisible();
  });
});
