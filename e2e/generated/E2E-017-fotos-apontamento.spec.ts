// Gerado a partir do cenário em e2e/scenarios (fonte indicada abaixo); mantenha os dois em sincronia.
// Source: e2e/scenarios/E2E-017-fotos-apontamento.scenario.json
// Scenario: E2E-017 — ACs: AC-004, AC-005, AC-006 — requires @playwright/test >= 1.42
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

test.describe('E2E-017 Fotos anexadas ao apontamento de colheita', () => {
  test.use({ baseURL: process.env['E2E_BASE_URL'] });
  // Preconditions (arrange before running):
  //   - Backend develop (com os anexos de apontamento) rodando com as migrations aplicadas
  //   - Agricultor com um plano e um único apontamento; caminho do detalhe do plano em E2E_PLAN_PATH; gestor da organização do agricultor em E2E_MANAGER_*
  //   - Esse apontamento tem a foto 'foto-semente.png' criada pela API, para a leitura do gestor (e a lista nunca chega a 5 fotos)
  //   - Segundo plano do agricultor com um apontamento sem fotos; caminho em E2E_EMPTY_PLAN_PATH
  //   - Arquivos de teste: E2E_PHOTO_PNG aponta para um PNG chamado foto-e2e.png (menos de 5 MB) e E2E_FILE_PDF para um PDF chamado doc-e2e.pdf

  test('happy_path — Agricultor envia uma foto PNG, abre a imagem ampliada e a exclui', {
    tag: ['@P0', '@producao', '@anexos', '@apontamento'],
    annotation: [{ type: 'E2E', description: 'E2E-017' }, { type: 'AC', description: 'AC-004' }, { type: 'AC', description: 'AC-005' }, { type: 'AC', description: 'AC-006' }, { type: 'user', description: 'FARMER' }],
  }, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(env('E2E_FARMER_EMAIL'));
    await page.locator('#password').fill(env('E2E_FARMER_PASSWORD'));
    await page.getByRole('button', { name: 'Entrar' }).click();
    // aguarda o redirecionamento pós-login
    await page.waitForURL(new RegExp(escapeRegExp('/admin')));
    await page.goto(env('E2E_PLAN_PATH'));
    await page.getByRole('button', { name: 'Fotos do apontamento', exact: true }).click();
    await page.getByTestId('attachment-input').setInputFiles(env('E2E_PHOTO_PNG'));
    await expect(page.locator('img[alt=\'foto-e2e.png\']')).toBeVisible();
    await page.getByRole('button', { name: 'Abrir foto-e2e.png', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'foto-e2e.png' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Excluir foto-e2e.png', exact: true }).click();
    await page.locator('[role=alertdialog] button:has-text(\'Excluir\')').click();
    await expect(page.getByRole('alertdialog', { name: 'Excluir foto?' })).toBeHidden();
    await expect(page.locator('img[alt=\'foto-e2e.png\']')).toBeHidden();
    await expect(page.locator('img[alt=\'foto-semente.png\']')).toBeVisible();
  });

  test('invalid_format — Agricultor tenta enviar um PDF e vê a mensagem de formato antes do envio', {
    tag: ['@P0', '@producao', '@anexos', '@apontamento'],
    annotation: [{ type: 'E2E', description: 'E2E-017' }, { type: 'AC', description: 'AC-004' }, { type: 'AC', description: 'AC-005' }, { type: 'AC', description: 'AC-006' }, { type: 'user', description: 'FARMER' }],
  }, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(env('E2E_FARMER_EMAIL'));
    await page.locator('#password').fill(env('E2E_FARMER_PASSWORD'));
    await page.getByRole('button', { name: 'Entrar' }).click();
    // aguarda o redirecionamento pós-login
    await page.waitForURL(new RegExp(escapeRegExp('/admin')));
    await page.goto(env('E2E_PLAN_PATH'));
    await page.getByRole('button', { name: 'Fotos do apontamento', exact: true }).click();
    await page.getByTestId('attachment-input').setInputFiles(env('E2E_FILE_PDF'));
    await expect(page.getByText('doc-e2e.pdf: Formato não aceito. Envie a imagem como JPEG, PNG ou WebP.')).toBeVisible();
  });

  test('manager_readonly — Gestor vê e baixa as fotos, sem enviar nem excluir', {
    tag: ['@P0', '@producao', '@anexos', '@apontamento'],
    annotation: [{ type: 'E2E', description: 'E2E-017' }, { type: 'AC', description: 'AC-004' }, { type: 'AC', description: 'AC-005' }, { type: 'AC', description: 'AC-006' }, { type: 'user', description: 'MANAGER' }],
  }, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(env('E2E_MANAGER_EMAIL'));
    await page.locator('#password').fill(env('E2E_MANAGER_PASSWORD'));
    await page.getByRole('button', { name: 'Entrar' }).click();
    // aguarda o redirecionamento pós-login
    await page.waitForURL(new RegExp(escapeRegExp('/admin')));
    await page.goto(env('E2E_PLAN_PATH'));
    await page.getByRole('button', { name: 'Fotos do apontamento', exact: true }).click();
    await expect(page.locator('img[alt=\'foto-semente.png\']')).toBeVisible();
    await expect(page.locator('img[alt=\'foto-semente.png\']')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Baixar foto-semente.png', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enviar fotos', exact: true })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Excluir foto-semente.png', exact: true })).toBeHidden();
  });

  test('empty_state — Apontamento sem fotos mostra o estado vazio e o botão de enviar ao agricultor', {
    tag: ['@P0', '@producao', '@anexos', '@apontamento'],
    annotation: [{ type: 'E2E', description: 'E2E-017' }, { type: 'AC', description: 'AC-004' }, { type: 'AC', description: 'AC-005' }, { type: 'AC', description: 'AC-006' }, { type: 'user', description: 'FARMER' }],
  }, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(env('E2E_FARMER_EMAIL'));
    await page.locator('#password').fill(env('E2E_FARMER_PASSWORD'));
    await page.getByRole('button', { name: 'Entrar' }).click();
    // aguarda o redirecionamento pós-login
    await page.waitForURL(new RegExp(escapeRegExp('/admin')));
    await page.goto(env('E2E_EMPTY_PLAN_PATH'));
    await page.getByRole('button', { name: 'Fotos do apontamento', exact: true }).click();
    await expect(page.getByText('Nenhuma foto anexada.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enviar fotos', exact: true })).toBeVisible();
  });
});
