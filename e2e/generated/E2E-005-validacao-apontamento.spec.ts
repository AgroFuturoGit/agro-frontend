// Gerado a partir do cenário em e2e/scenarios (fonte indicada abaixo); mantenha os dois em sincronia.
// Source: e2e/scenarios/E2E-005-validacao-apontamento.scenario.json
// Scenario: E2E-005 — ACs: AC-009 — requires @playwright/test >= 1.42
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

test.describe('E2E-005 Validação de apontamentos de colheita e correção pelo agricultor', () => {
  test.use({ baseURL: process.env['E2E_BASE_URL'] });
  // Preconditions (arrange before running):
  //   - Backend develop rodando com as migrations aplicadas
  //   - Técnico com assistência ativa à comunidade do agricultor; nome em E2E_TECH_NAME
  //   - Plano de produção do agricultor em E2E_PLAN_PATH com dois apontamentos PENDENTES, de datas dd/mm/aaaa em E2E_EXEC_VALIDATE_DATE e E2E_EXEC_REJECT_DATE; nome do agricultor em E2E_FARMER_NAME
  //   - Motivo da rejeição em E2E_REJECT_REASON

  test('happy_path — Técnico valida um apontamento pendente e ele passa a Validado', {
    tag: ['@P0', '@producao', '@validacao', '@apontamento'],
    annotation: [{ type: 'E2E', description: 'E2E-005' }, { type: 'AC', description: 'AC-009' }, { type: 'user', description: 'TECHNICIAN' }],
  }, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(env('E2E_TECH_EMAIL'));
    await page.locator('#password').fill(env('E2E_TECH_PASSWORD'));
    await page.getByRole('button', { name: 'Entrar' }).click();
    // aguarda o redirecionamento pós-login
    await page.waitForURL(new RegExp(escapeRegExp('/admin')));
    await page.goto(env('E2E_PLAN_PATH'));
    await page.locator(`tr:has-text('${env('E2E_EXEC_VALIDATE_DATE')}') button[aria-label='Validar apontamento']`).click();
    await page.getByRole('button', { name: 'Validar' }).click();
    await expect(page.locator(`tr:has-text('${env('E2E_EXEC_VALIDATE_DATE')}') [data-status='VALIDATED']`)).toBeVisible();
  });

  test('rejeitar_com_motivo — Técnico rejeita outro apontamento informando o motivo, que aparece junto do status', {
    tag: ['@P0', '@producao', '@validacao', '@apontamento'],
    annotation: [{ type: 'E2E', description: 'E2E-005' }, { type: 'AC', description: 'AC-009' }, { type: 'user', description: 'TECHNICIAN' }],
  }, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(env('E2E_TECH_EMAIL'));
    await page.locator('#password').fill(env('E2E_TECH_PASSWORD'));
    await page.getByRole('button', { name: 'Entrar' }).click();
    // aguarda o redirecionamento pós-login
    await page.waitForURL(new RegExp(escapeRegExp('/admin')));
    await page.goto(env('E2E_PLAN_PATH'));
    await page.locator(`tr:has-text('${env('E2E_EXEC_REJECT_DATE')}') button[aria-label='Rejeitar apontamento']`).click();
    await page.getByLabel('Motivo (opcional)').fill(env('E2E_REJECT_REASON'));
    await page.getByRole('button', { name: 'Rejeitar' }).click();
    await expect(page.locator(`tr:has-text('${env('E2E_EXEC_REJECT_DATE')}') [data-status='REJECTED']`)).toBeVisible();
    await expect(page.getByText(env('E2E_REJECT_REASON'))).toBeVisible();
  });

  test('agricultor_corrige_rejeitado — Agricultor corrige a quantidade do apontamento rejeitado e ele volta a Pendente', {
    tag: ['@P0', '@producao', '@validacao', '@apontamento'],
    annotation: [{ type: 'E2E', description: 'E2E-005' }, { type: 'AC', description: 'AC-009' }, { type: 'user', description: 'FARMER' }],
  }, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(env('E2E_TECH_EMAIL'));
    await page.locator('#password').fill(env('E2E_TECH_PASSWORD'));
    await page.getByRole('button', { name: 'Entrar' }).click();
    // aguarda o redirecionamento pós-login
    await page.waitForURL(new RegExp(escapeRegExp('/admin')));
    await page.getByRole('button', { name: env('E2E_TECH_NAME') }).click();
    await page.getByRole('menuitem', { name: 'Sair' }).click();
    // logout
    await page.waitForURL(new RegExp(escapeRegExp('/login')));
    await page.getByLabel('E-mail').fill(env('E2E_FARMER_EMAIL'));
    await page.locator('#password').fill(env('E2E_FARMER_PASSWORD'));
    await page.getByRole('button', { name: 'Entrar' }).click();
    // aguarda o redirecionamento pós-login
    await page.waitForURL(new RegExp(escapeRegExp('/admin')));
    await page.goto(env('E2E_PLAN_PATH'));
    await page.locator(`tr:has-text('${env('E2E_EXEC_REJECT_DATE')}') button[aria-label='Editar apontamento']`).click();
    await page.getByLabel('Quantidade colhida').fill('7');
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(page.locator(`tr:has-text('${env('E2E_EXEC_REJECT_DATE')}') [data-status='PENDING']`)).toBeVisible();
  });

  test('forbidden_agricultor_sem_decisao — Agricultor não vê Validar nem Rejeitar em nenhuma linha', {
    tag: ['@P0', '@producao', '@validacao', '@apontamento'],
    annotation: [{ type: 'E2E', description: 'E2E-005' }, { type: 'AC', description: 'AC-009' }, { type: 'user', description: 'FARMER' }],
  }, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(env('E2E_TECH_EMAIL'));
    await page.locator('#password').fill(env('E2E_TECH_PASSWORD'));
    await page.getByRole('button', { name: 'Entrar' }).click();
    // aguarda o redirecionamento pós-login
    await page.waitForURL(new RegExp(escapeRegExp('/admin')));
    await page.getByRole('button', { name: env('E2E_TECH_NAME') }).click();
    await page.getByRole('menuitem', { name: 'Sair' }).click();
    // logout
    await page.waitForURL(new RegExp(escapeRegExp('/login')));
    await page.getByLabel('E-mail').fill(env('E2E_FARMER_EMAIL'));
    await page.locator('#password').fill(env('E2E_FARMER_PASSWORD'));
    await page.getByRole('button', { name: 'Entrar' }).click();
    // aguarda o redirecionamento pós-login
    await page.waitForURL(new RegExp(escapeRegExp('/admin')));
    await page.goto(env('E2E_PLAN_PATH'));
    await expect(page.locator('button[aria-label=\'Validar apontamento\']')).toHaveCount(0);
    await expect(page.locator('button[aria-label=\'Rejeitar apontamento\']')).toHaveCount(0);
  });
});
