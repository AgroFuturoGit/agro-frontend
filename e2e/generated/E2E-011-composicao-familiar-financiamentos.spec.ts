// Gerado a partir do cenário em e2e/scenarios (fonte indicada abaixo); mantenha os dois em sincronia.
// Source: e2e/scenarios/E2E-011-composicao-familiar-financiamentos.scenario.json
// Scenario: E2E-011 — ACs: AC-008, AC-009 — requires @playwright/test >= 1.42
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

test.describe('E2E-011 Composição familiar e financiamentos do agricultor', () => {
  test.use({ baseURL: process.env['E2E_BASE_URL'] });
  // Preconditions (arrange before running):
  //   - Backend develop rodando com as migrations aplicadas
  //   - Agricultor numa comunidade com técnico de assistência ativa (E2E_TECH_*) e gestor da organização (E2E_MANAGER_*); caminho da página do agricultor em E2E_PRODUCER_PATH
  //   - Agricultor com um membro 'Membro Semente' (50 anos) e um financiamento 'Financiamento Semente' (Quitado) criados pela API, para a leitura do gestor
  //   - Técnico sem assistência nessa comunidade em E2E_TECH_NOASSIST_EMAIL / E2E_TECH_NOASSIST_PASSWORD (usado só na variante forbidden)

  test('happy_path — Técnico assistente cadastra, edita e exclui um membro familiar e um financiamento', {
    tag: ['@P0', '@produtores', '@composicao-familiar', '@financiamentos'],
    annotation: [{ type: 'E2E', description: 'E2E-011' }, { type: 'AC', description: 'AC-008' }, { type: 'AC', description: 'AC-009' }, { type: 'user', description: 'TECHNICIAN' }],
  }, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(env('E2E_TECH_EMAIL'));
    await page.locator('#password').fill(env('E2E_TECH_PASSWORD'));
    await page.getByRole('button', { name: 'Entrar' }).click();
    // aguarda o redirecionamento pós-login
    await page.waitForURL(new RegExp(escapeRegExp('/admin')));
    await page.goto(env('E2E_PRODUCER_PATH'));
    await page.getByRole('button', { name: 'Adicionar membro', exact: true }).click();
    await page.getByLabel('Nome', { exact: true }).fill('Membro E2E Tecnico');
    await page.getByLabel('Parentesco', { exact: true }).fill('Sobrinho');
    await page.getByLabel('Idade', { exact: true }).fill('20');
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(page.getByRole('cell', { name: 'Membro E2E Tecnico', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Editar Membro E2E Tecnico', exact: true }).click();
    await page.getByLabel('Idade', { exact: true }).fill('21');
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(page.getByRole('cell', { name: '21', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Adicionar financiamento', exact: true }).click();
    await page.getByLabel('Descrição', { exact: true }).fill('Financiamento E2E Tecnico');
    await page.getByLabel('Situação', { exact: true }).selectOption('APPROVED');
    await page.getByLabel('Valor (R$)', { exact: true }).fill('1.234,56');
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(page.getByRole('cell', { name: 'Financiamento E2E Tecnico', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Editar Financiamento E2E Tecnico', exact: true }).click();
    await page.getByLabel('Valor (R$)', { exact: true }).fill('2.000,00');
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(page.getByRole('cell', { name: 'R$ 2.000,00' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Aprovado' })).toBeVisible();
    await page.getByRole('button', { name: 'Excluir Membro E2E Tecnico', exact: true }).click();
    await page.locator('[role=alertdialog] button:has-text(\'Excluir\')').click();
    await expect(page.getByRole('button', { name: 'Excluir Financiamento E2E Tecnico', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Excluir Financiamento E2E Tecnico', exact: true }).click();
    await page.locator('[role=alertdialog] button:has-text(\'Excluir\')').click();
    await expect(page.getByRole('cell', { name: 'Financiamento Semente', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Membro E2E Tecnico', exact: true })).toBeHidden();
    await expect(page.getByRole('cell', { name: 'Financiamento E2E Tecnico', exact: true })).toBeHidden();
    await expect(page.getByRole('cell', { name: 'Membro Semente', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Financiamento Semente', exact: true })).toBeVisible();
  });

  test('manager_readonly — Gestor da organização vê os registros sem nenhuma ação de escrita', {
    tag: ['@P0', '@produtores', '@composicao-familiar', '@financiamentos'],
    annotation: [{ type: 'E2E', description: 'E2E-011' }, { type: 'AC', description: 'AC-008' }, { type: 'AC', description: 'AC-009' }, { type: 'user', description: 'MANAGER' }],
  }, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(env('E2E_MANAGER_EMAIL'));
    await page.locator('#password').fill(env('E2E_MANAGER_PASSWORD'));
    await page.getByRole('button', { name: 'Entrar' }).click();
    // aguarda o redirecionamento pós-login
    await page.waitForURL(new RegExp(escapeRegExp('/admin')));
    await page.goto(env('E2E_PRODUCER_PATH'));
    await expect(page.getByRole('cell', { name: 'Membro Semente', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Membro Semente', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Financiamento Semente', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Adicionar membro', exact: true })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Adicionar financiamento', exact: true })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Editar Membro Semente', exact: true })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Excluir Membro Semente', exact: true })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Editar Financiamento Semente', exact: true })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Excluir Financiamento Semente', exact: true })).toBeHidden();
  });

  test('forbidden — Técnico sem assistência tenta cadastrar e vê o 403 do back, sem criar nada', {
    tag: ['@P0', '@produtores', '@composicao-familiar', '@financiamentos'],
    annotation: [{ type: 'E2E', description: 'E2E-011' }, { type: 'AC', description: 'AC-008' }, { type: 'AC', description: 'AC-009' }, { type: 'user', description: 'TECHNICIAN' }],
  }, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(env('E2E_TECH_NOASSIST_EMAIL'));
    await page.locator('#password').fill(env('E2E_TECH_NOASSIST_PASSWORD'));
    await page.getByRole('button', { name: 'Entrar' }).click();
    // aguarda o redirecionamento pós-login
    await page.waitForURL(new RegExp(escapeRegExp('/admin')));
    await page.goto(env('E2E_PRODUCER_PATH'));
    await page.getByRole('button', { name: 'Adicionar membro', exact: true }).click();
    await page.getByLabel('Nome', { exact: true }).fill('Membro Proibido');
    await page.getByLabel('Parentesco', { exact: true }).fill('Primo');
    await page.getByLabel('Idade', { exact: true }).fill('30');
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(page.locator('[role=dialog] [role=alert]')).toContainText('O técnico só pode visualizar agricultores das comunidades sob sua assistência.');
    await expect(page.getByRole('cell', { name: 'Membro Proibido', exact: true })).toBeHidden();
  });
});
