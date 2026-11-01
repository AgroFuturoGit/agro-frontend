// Gerado a partir do cenário em e2e/scenarios (fonte indicada abaixo); mantenha os dois em sincronia.
// Source: e2e/scenarios/E2E-016-exportar-relatorio.scenario.json
// Scenario: E2E-016 — ACs: AC-005, AC-009 — requires @playwright/test >= 1.42
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

test.describe('E2E-016 Exportar o relatório da Visão geral em PDF e Excel', () => {
  test.use({ baseURL: process.env['E2E_BASE_URL'] });
  // Preconditions (arrange before running):
  //   - Backend develop rodando com as migrations aplicadas
  //   - Técnico vinculado a ao menos uma comunidade com agricultores e planos na safra vigente; nome da comunidade em E2E_TECHNICIAN_COMMUNITY
  //   - Ao menos uma organização com planos na safra vigente; nome em E2E_ADMIN_ORG

  test('happy_path — Técnico exporta o PDF com a comunidade filtrada', {
    tag: ['@P0', '@painel', '@exportacao', '@analytics'],
    annotation: [{ type: 'E2E', description: 'E2E-016' }, { type: 'AC', description: 'AC-005' }, { type: 'AC', description: 'AC-009' }, { type: 'user', description: 'TECHNICIAN' }],
  }, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(env('E2E_TECHNICIAN_EMAIL'));
    await page.locator('#password').fill(env('E2E_TECHNICIAN_PASSWORD'));
    await page.getByRole('button', { name: 'Entrar' }).click();
    // aguarda o redirecionamento pós-login
    await page.waitForURL(new RegExp(escapeRegExp('/admin')));
    await page.goto('/admin');
    await expect(page.getByText('Comunidades atendidas')).toBeVisible();
    await page.getByRole('combobox', { name: 'Comunidade' }).click();
    await page.getByRole('option', { name: env('E2E_TECHNICIAN_COMMUNITY') }).click();
    await expect(page.getByText('Comunidades atendidas')).toBeVisible();
    await page.getByRole('button', { name: 'Exportar relatório' }).click();
    await page.getByRole('menuitem', { name: 'PDF' }).click();
    await expect(page.getByRole('button', { name: 'Exportar relatório' })).toBeEnabled();
    await expect(page.getByRole('alert')).toBeHidden();
  });

  test('admin_exporta_excel — Admin exporta o Excel do global filtrado por organização', {
    tag: ['@P0', '@painel', '@exportacao', '@analytics'],
    annotation: [{ type: 'E2E', description: 'E2E-016' }, { type: 'AC', description: 'AC-005' }, { type: 'AC', description: 'AC-009' }, { type: 'user', description: 'ADMIN' }],
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
    await page.getByRole('button', { name: 'Exportar relatório' }).click();
    await page.getByRole('menuitem', { name: 'Excel (.xlsx)' }).click();
    await expect(page.getByRole('button', { name: 'Exportar relatório' })).toBeEnabled();
    await expect(page.getByRole('alert')).toBeHidden();
  });
});
