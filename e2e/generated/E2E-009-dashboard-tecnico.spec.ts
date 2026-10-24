// Gerado a partir do cenário em e2e/scenarios (fonte indicada abaixo); mantenha os dois em sincronia.
// Source: e2e/scenarios/E2E-009-dashboard-tecnico.scenario.json
// Scenario: E2E-009 — ACs: AC-010 — requires @playwright/test >= 1.42
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

test.describe('E2E-009 Dashboard do técnico na Visão geral', () => {
  test.use({ baseURL: process.env['E2E_BASE_URL'] });
  // Preconditions (arrange before running):
  //   - Backend develop rodando com as migrations aplicadas
  //   - Técnico criado por POST /technicians (admin) e vinculado a duas comunidades com agricultores e planos na safra vigente
  //   - Ao menos um plano da safra vigente gera alerta (ex.: janela de colheita vencida sem apontamentos)
  //   - Nomes em E2E_TECHNICIAN_COMMUNITY (comunidade assistida a filtrar), E2E_TECHNICIAN_OTHER_COMMUNITY (outra assistida, some ao filtrar) e E2E_TECHNICIAN_CROP (cultura com plano na comunidade filtrada); nome (ou início) do agricultor com alerta em E2E_TECHNICIAN_ALERT_FARMER

  test('happy_path — Técnico vê indicadores, alertas, gráfico e tabela da carteira', {
    tag: ['@P0', '@painel', '@tecnico', '@analytics'],
    annotation: [{ type: 'E2E', description: 'E2E-009' }, { type: 'AC', description: 'AC-010' }, { type: 'user', description: 'TECHNICIAN' }],
  }, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(env('E2E_TECHNICIAN_EMAIL'));
    await page.locator('#password').fill(env('E2E_TECHNICIAN_PASSWORD'));
    await page.getByRole('button', { name: 'Entrar' }).click();
    // aguarda o redirecionamento pós-login
    await page.waitForURL(new RegExp(escapeRegExp('/admin')));
    await page.goto('/admin');
    await expect(page.getByText('Comunidades atendidas')).toBeVisible();
    await expect(page.getByText('Realizado (validado)')).toBeVisible();
    await expect(page.getByText('Pendente de validação')).toBeVisible();
    await expect(page.getByTestId('community-bar-chart')).toBeVisible();
    await expect(page.getByText('Alertas (')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Agricultor' })).toBeVisible();
  });

  test('filtra_comunidade_cultura — Filtrar por comunidade e por cultura refaz o resumo', {
    tag: ['@P0', '@painel', '@tecnico', '@analytics'],
    annotation: [{ type: 'E2E', description: 'E2E-009' }, { type: 'AC', description: 'AC-010' }, { type: 'user', description: 'TECHNICIAN' }],
  }, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(env('E2E_TECHNICIAN_EMAIL'));
    await page.locator('#password').fill(env('E2E_TECHNICIAN_PASSWORD'));
    await page.getByRole('button', { name: 'Entrar' }).click();
    // aguarda o redirecionamento pós-login
    await page.waitForURL(new RegExp(escapeRegExp('/admin')));
    await page.goto('/admin');
    await page.getByRole('combobox', { name: 'Comunidade' }).click();
    await page.getByRole('option', { name: env('E2E_TECHNICIAN_COMMUNITY') }).click();
    await page.getByRole('combobox', { name: 'Cultura' }).click();
    await page.getByRole('option', { name: env('E2E_TECHNICIAN_CROP') }).click();
    await expect(page.getByRole('heading', { name: 'Agricultores' })).toBeVisible();
    await expect(page.getByRole('cell', { name: env('E2E_TECHNICIAN_OTHER_COMMUNITY') })).toBeHidden();
  });

  test('abre_plano_pelo_alerta — O alerta leva ao detalhe do plano', {
    tag: ['@P0', '@painel', '@tecnico', '@analytics'],
    annotation: [{ type: 'E2E', description: 'E2E-009' }, { type: 'AC', description: 'AC-010' }, { type: 'user', description: 'TECHNICIAN' }],
  }, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(env('E2E_TECHNICIAN_EMAIL'));
    await page.locator('#password').fill(env('E2E_TECHNICIAN_PASSWORD'));
    await page.getByRole('button', { name: 'Entrar' }).click();
    // aguarda o redirecionamento pós-login
    await page.waitForURL(new RegExp(escapeRegExp('/admin')));
    await page.goto('/admin');
    // link do alerta do agricultor indicado
    await page.getByRole('link', { name: `Ver plano de ${env('E2E_TECHNICIAN_ALERT_FARMER')}` }).click();
    await expect(page).toHaveURL(new RegExp(escapeRegExp('/planos/')));
    await expect(page.getByText('Apontamentos de colheita')).toBeVisible();
  });
});
