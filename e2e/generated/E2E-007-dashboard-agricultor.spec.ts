// Gerado a partir do cenário em e2e/scenarios (fonte indicada abaixo); mantenha os dois em sincronia.
// Source: e2e/scenarios/E2E-007-dashboard-agricultor.scenario.json
// Scenario: E2E-007 — ACs: AC-010 — requires @playwright/test >= 1.42
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

test.describe('E2E-007 Dashboard do agricultor na Visão geral', () => {
  test.use({ baseURL: process.env['E2E_BASE_URL'] });
  // Preconditions (arrange before running):
  //   - Backend develop rodando com as migrations aplicadas
  //   - Agricultor com ao menos um plano e um apontamento validado na safra vigente; segunda safra listada em GET /harvests
  //   - Nome da safra alternativa (com planos do agricultor) em E2E_FARMER_OTHER_HARVEST

  test('happy_path — Agricultor vê totais e cartões, troca de safra e abre um plano', {
    tag: ['@P0', '@painel', '@agricultor', '@analytics'],
    annotation: [{ type: 'E2E', description: 'E2E-007' }, { type: 'AC', description: 'AC-010' }, { type: 'user', description: 'FARMER' }],
  }, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(env('E2E_FARMER_EMAIL'));
    await page.locator('#password').fill(env('E2E_FARMER_PASSWORD'));
    await page.getByRole('button', { name: 'Entrar' }).click();
    // aguarda o redirecionamento pós-login
    await page.waitForURL(new RegExp(escapeRegExp('/admin')));
    await page.goto('/admin');
    await expect(page.getByText('Pendente de validação')).toBeVisible();
    await expect(page.getByText('Realizado (validado)')).toBeVisible();
    await expect(page.getByTestId('farmer-plan-card')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Comunidade' })).toBeHidden();
  });

  test('troca_safra — Trocar a safra refaz o resumo', {
    tag: ['@P0', '@painel', '@agricultor', '@analytics'],
    annotation: [{ type: 'E2E', description: 'E2E-007' }, { type: 'AC', description: 'AC-010' }, { type: 'user', description: 'FARMER' }],
  }, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(env('E2E_FARMER_EMAIL'));
    await page.locator('#password').fill(env('E2E_FARMER_PASSWORD'));
    await page.getByRole('button', { name: 'Entrar' }).click();
    // aguarda o redirecionamento pós-login
    await page.waitForURL(new RegExp(escapeRegExp('/admin')));
    await page.goto('/admin');
    await page.getByLabel('Safra').selectOption(env('E2E_FARMER_OTHER_HARVEST'));
    await expect(page.getByText(`Safra: ${env('E2E_FARMER_OTHER_HARVEST')}`)).toBeVisible();
  });

  test('abre_plano — O cartão leva ao detalhe do plano', {
    tag: ['@P0', '@painel', '@agricultor', '@analytics'],
    annotation: [{ type: 'E2E', description: 'E2E-007' }, { type: 'AC', description: 'AC-010' }, { type: 'user', description: 'FARMER' }],
  }, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(env('E2E_FARMER_EMAIL'));
    await page.locator('#password').fill(env('E2E_FARMER_PASSWORD'));
    await page.getByRole('button', { name: 'Entrar' }).click();
    // aguarda o redirecionamento pós-login
    await page.waitForURL(new RegExp(escapeRegExp('/admin')));
    await page.goto('/admin');
    // primeiro cartão
    await page.getByRole('link', { name: 'Ver plano' }).click();
    await expect(page).toHaveURL(new RegExp(escapeRegExp('/planos/')));
    await expect(page.getByText('Apontamentos de colheita')).toBeVisible();
  });
});
