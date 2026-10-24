// Gerado a partir do cenário em e2e/scenarios (fonte indicada abaixo); mantenha os dois em sincronia.
// Source: e2e/scenarios/E2E-006-painel-producao-perfis.scenario.json
// Scenario: E2E-006 — ACs: AC-010 — requires @playwright/test >= 1.42
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

test.describe('E2E-006 Painel de produção na Visão geral por perfil', () => {
  test.use({ baseURL: process.env['E2E_BASE_URL'] });
  // Preconditions (arrange before running):
  //   - Backend develop rodando com as migrations aplicadas
  //   - Nomes de exibição dos usuários em E2E_ADMIN_NAME, E2E_MANAGER_NAME, E2E_TECH_NAME e E2E_FARMER_NAME (botão do menu do usuário)
  //   - Planos com apontamentos validados no recorte de cada perfil; textos esperados da meta em kg (ex.: 40.000 kg) em E2E_ADMIN_EXPECTED_META, E2E_MANAGER_EXPECTED_META, E2E_TECH_EXPECTED_META e E2E_FARMER_EXPECTED_META, e do gauge (ex.: 45% da meta alcançada) em E2E_<PERFIL>_EXPECTED_GAUGE

  test('happy_path — Administrador vê o painel com todas as comunidades', {
    tag: ['@P0', '@painel', '@visao-geral', '@perfis'],
    annotation: [{ type: 'E2E', description: 'E2E-006' }, { type: 'AC', description: 'AC-010' }, { type: 'user', description: 'ADMIN' }],
  }, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(env('E2E_ADMIN_EMAIL'));
    await page.locator('#password').fill(env('E2E_ADMIN_PASSWORD'));
    await page.getByRole('button', { name: 'Entrar' }).click();
    // aguarda o redirecionamento pós-login
    await page.waitForURL(new RegExp(escapeRegExp('/admin')));
    await page.goto('/admin');
    await expect(page.getByText(env('E2E_ADMIN_EXPECTED_META'))).toBeVisible();
    await expect(page.getByRole('img', { name: env('E2E_ADMIN_EXPECTED_GAUGE') })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Comunidade' })).toBeVisible();
  });

  test('gestor — Gestor vê o painel recortado pela sua organização, com a tabela por comunidade', {
    tag: ['@P0', '@painel', '@visao-geral', '@perfis'],
    annotation: [{ type: 'E2E', description: 'E2E-006' }, { type: 'AC', description: 'AC-010' }, { type: 'user', description: 'MANAGER' }],
  }, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(env('E2E_ADMIN_EMAIL'));
    await page.locator('#password').fill(env('E2E_ADMIN_PASSWORD'));
    await page.getByRole('button', { name: 'Entrar' }).click();
    // aguarda o redirecionamento pós-login
    await page.waitForURL(new RegExp(escapeRegExp('/admin')));
    await page.getByRole('button', { name: env('E2E_ADMIN_NAME') }).click();
    await page.getByRole('menuitem', { name: 'Sair' }).click();
    // logout
    await page.waitForURL(new RegExp(escapeRegExp('/login')));
    await page.getByLabel('E-mail').fill(env('E2E_MANAGER_EMAIL'));
    await page.locator('#password').fill(env('E2E_MANAGER_PASSWORD'));
    await page.getByRole('button', { name: 'Entrar' }).click();
    // aguarda o redirecionamento pós-login
    await page.waitForURL(new RegExp(escapeRegExp('/admin')));
    await page.goto('/admin');
    await expect(page.getByText(env('E2E_MANAGER_EXPECTED_META'))).toBeVisible();
    await expect(page.getByRole('img', { name: env('E2E_MANAGER_EXPECTED_GAUGE') })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Comunidade' })).toBeVisible();
  });

  test('tecnico — Técnico vê o painel recortado pelas comunidades com assistência ativa', {
    tag: ['@P0', '@painel', '@visao-geral', '@perfis'],
    annotation: [{ type: 'E2E', description: 'E2E-006' }, { type: 'AC', description: 'AC-010' }, { type: 'user', description: 'TECHNICIAN' }],
  }, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(env('E2E_ADMIN_EMAIL'));
    await page.locator('#password').fill(env('E2E_ADMIN_PASSWORD'));
    await page.getByRole('button', { name: 'Entrar' }).click();
    // aguarda o redirecionamento pós-login
    await page.waitForURL(new RegExp(escapeRegExp('/admin')));
    await page.getByRole('button', { name: env('E2E_ADMIN_NAME') }).click();
    await page.getByRole('menuitem', { name: 'Sair' }).click();
    // logout
    await page.waitForURL(new RegExp(escapeRegExp('/login')));
    await page.getByLabel('E-mail').fill(env('E2E_TECH_EMAIL'));
    await page.locator('#password').fill(env('E2E_TECH_PASSWORD'));
    await page.getByRole('button', { name: 'Entrar' }).click();
    // aguarda o redirecionamento pós-login
    await page.waitForURL(new RegExp(escapeRegExp('/admin')));
    await page.goto('/admin');
    await expect(page.getByText(env('E2E_TECH_EXPECTED_META'))).toBeVisible();
    await expect(page.getByRole('img', { name: env('E2E_TECH_EXPECTED_GAUGE') })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Comunidade' })).toBeVisible();
  });

  test('agricultor — Agricultor vê só os próprios totais, sem tabela por comunidade', {
    tag: ['@P0', '@painel', '@visao-geral', '@perfis'],
    annotation: [{ type: 'E2E', description: 'E2E-006' }, { type: 'AC', description: 'AC-010' }, { type: 'user', description: 'FARMER' }],
  }, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(env('E2E_ADMIN_EMAIL'));
    await page.locator('#password').fill(env('E2E_ADMIN_PASSWORD'));
    await page.getByRole('button', { name: 'Entrar' }).click();
    // aguarda o redirecionamento pós-login
    await page.waitForURL(new RegExp(escapeRegExp('/admin')));
    await page.getByRole('button', { name: env('E2E_ADMIN_NAME') }).click();
    await page.getByRole('menuitem', { name: 'Sair' }).click();
    // logout
    await page.waitForURL(new RegExp(escapeRegExp('/login')));
    await page.getByLabel('E-mail').fill(env('E2E_FARMER_EMAIL'));
    await page.locator('#password').fill(env('E2E_FARMER_PASSWORD'));
    await page.getByRole('button', { name: 'Entrar' }).click();
    // aguarda o redirecionamento pós-login
    await page.waitForURL(new RegExp(escapeRegExp('/admin')));
    await page.goto('/admin');
    await expect(page.getByText(env('E2E_FARMER_EXPECTED_META'))).toBeVisible();
    await expect(page.getByRole('img', { name: env('E2E_FARMER_EXPECTED_GAUGE') })).toBeVisible();
    await expect(page.getByRole('table')).toHaveCount(0);
  });
});
