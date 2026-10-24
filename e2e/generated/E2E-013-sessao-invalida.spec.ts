// Gerado a partir do cenário em e2e/scenarios (fonte indicada abaixo); mantenha os dois em sincronia.
// Source: e2e/scenarios/E2E-013-sessao-invalida.scenario.json
// Scenario: E2E-013 — ACs: AC-006 — requires @playwright/test >= 1.42
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

test.describe('E2E-013 Sessão inválida leva ao login e volta à página pedida', () => {
  test.use({ baseURL: process.env['E2E_BASE_URL'] });
  // Preconditions (arrange before running):
  //   - Backend develop rodando com as migrations aplicadas
  //   - O contexto do navegador começa com o cookie agro_token adulterado (valor inválido), injetado pelo ambiente antes da execução; sem ele o fluxo também passa, pois o proxy manda para o login

  test('happy_path — Sessão inválida em /admin/usuarios leva ao login e, depois de entrar, volta para a página', {
    tag: ['@P0', '@sessao', '@login'],
    annotation: [{ type: 'E2E', description: 'E2E-013' }, { type: 'AC', description: 'AC-006' }, { type: 'user', description: 'ADMIN' }],
  }, async ({ page }) => {
    await page.goto('/admin/usuarios');
    // a sessão inválida é encerrada e o usuário cai no login
    await page.waitForURL(new RegExp(escapeRegExp('/login')));
    await page.getByLabel('E-mail').fill(env('E2E_ADMIN_EMAIL'));
    await page.locator('#password').fill(env('E2E_ADMIN_PASSWORD'));
    await page.getByRole('button', { name: 'Entrar' }).click();
    // volta para a página pedida
    await page.waitForURL(new RegExp(escapeRegExp('/admin/usuarios')));
    await expect(page).toHaveURL(new RegExp(escapeRegExp('/admin/usuarios')));
  });

  test('login_com_token_adulterado — Abrir /login com token adulterado mostra o formulário', {
    tag: ['@P0', '@sessao', '@login'],
    annotation: [{ type: 'E2E', description: 'E2E-013' }, { type: 'AC', description: 'AC-006' }, { type: 'user', description: 'ADMIN' }],
  }, async ({ page }) => {
    await page.goto('/admin/usuarios');
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  });
});
