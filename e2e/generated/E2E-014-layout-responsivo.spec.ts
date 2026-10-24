// Gerado a partir do cenário em e2e/scenarios (fonte indicada abaixo); mantenha os dois em sincronia.
// Source: e2e/scenarios/E2E-014-layout-responsivo.scenario.json
// Scenario: E2E-014 — ACs: AC-001, AC-006, AC-009 — requires @playwright/test >= 1.42
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

test.describe('E2E-014 Telas de lista cabem em 768px com layout acessível', () => {
  test.use({ baseURL: process.env['E2E_BASE_URL'], viewport: { width: 768, height: 800 } });
  // Preconditions (arrange before running):
  //   - Backend develop rodando com as migrations aplicadas
  //   - Usuário ADMIN existente e ativo

  test('happy_path — Admin percorre Usuários, Safras e Organizações em 768px', {
    tag: ['@P1', '@layout', '@responsivo'],
    annotation: [{ type: 'E2E', description: 'E2E-014' }, { type: 'AC', description: 'AC-001' }, { type: 'AC', description: 'AC-006' }, { type: 'AC', description: 'AC-009' }, { type: 'user', description: 'ADMIN' }],
  }, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(env('E2E_ADMIN_EMAIL'));
    await page.locator('#password').fill(env('E2E_ADMIN_PASSWORD'));
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForURL(new RegExp(escapeRegExp('/admin')));
    await page.goto('/admin/usuarios');
    await expect(page.getByRole('button', { name: 'Novo usuário' })).toBeVisible();
    await page.goto('/admin/safras');
    await expect(page.getByRole('button', { name: 'Nova safra' })).toBeVisible();
    await page.goto('/admin/organizacoes');
    await expect(page.getByRole('heading', { name: 'Painel administrativo' })).toBeVisible();
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Painel administrativo' })).toBeVisible();
  });
});
