// Gerado a partir do cenário em e2e/scenarios (fonte indicada abaixo); mantenha os dois em sincronia.
// Source: e2e/scenarios/E2E-004-perfis-agricultor-tecnico.scenario.json
// Scenario: E2E-004 — ACs: AC-007, AC-009 — requires @playwright/test >= 1.42
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

test.describe('E2E-004 Perfis de técnico e agricultor alinhados ao contrato da Feature 5.2', () => {
  test.use({ baseURL: process.env['E2E_BASE_URL'] });
  // Preconditions (arrange before running):
  //   - Backend develop rodando com as migrations aplicadas
  //   - Comunidade existente cujo caminho é informado em E2E_COMMUNITY_PATH (por exemplo /admin/organizacoes/{org}/comunidades/{comunidade}) e cujo nome é E2E_COMMUNITY_NAME
  //   - E-mails e CPFs válidos e inéditos em E2E_TECH_EMAIL, E2E_TECH_CPF, E2E_FARMER_EMAIL e E2E_FARMER_CPF; senhas em E2E_TECH_PASSWORD e E2E_FARMER_PASSWORD; nomes em E2E_TECH_NAME e E2E_FARMER_NAME

  test('happy_path — Técnico criado pela tela de Usuários aparece na lista com perfil criado por POST /technicians', {
    tag: ['@P0', '@usuarios', '@tecnico', '@agricultor'],
    annotation: [{ type: 'E2E', description: 'E2E-004' }, { type: 'AC', description: 'AC-007' }, { type: 'AC', description: 'AC-009' }, { type: 'user', description: 'ADMIN' }],
  }, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(env('E2E_ADMIN_EMAIL'));
    await page.locator('#password').fill(env('E2E_ADMIN_PASSWORD'));
    await page.getByRole('button', { name: 'Entrar' }).click();
    // aguarda o redirecionamento pós-login
    await page.waitForURL(new RegExp(escapeRegExp('/admin')));
    await page.goto('/admin/usuarios');
    await page.getByRole('button', { name: 'Novo usuário' }).click();
    await page.getByRole('combobox', { name: 'Papel' }).click();
    await page.getByRole('option', { name: 'Técnico' }).click();
    await page.getByLabel('Nome completo').fill(env('E2E_TECH_NAME'));
    await page.getByLabel('E-mail').fill(env('E2E_TECH_EMAIL'));
    await page.locator('#password').fill(env('E2E_TECH_PASSWORD'));
    await page.getByLabel('CPF').fill(env('E2E_TECH_CPF'));
    await page.getByRole('combobox', { name: 'Tipo de registro' }).click();
    await page.getByRole('option', { name: 'CREA' }).click();
    await page.getByLabel('Número do registro').fill('12345');
    await page.getByLabel('Especialidade').fill('Agronomia');
    await page.getByRole('button', { name: 'Cadastrar' }).click();
    await expect(page.getByText(env('E2E_TECH_EMAIL'))).toBeVisible();
  });

  test('agricultor_cadastro_edicao — Agricultor cadastrado com nome local, endereço e GPS é editado e os dados voltam do back', {
    tag: ['@P0', '@usuarios', '@tecnico', '@agricultor'],
    annotation: [{ type: 'E2E', description: 'E2E-004' }, { type: 'AC', description: 'AC-007' }, { type: 'AC', description: 'AC-009' }, { type: 'user', description: 'ADMIN' }],
  }, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(env('E2E_ADMIN_EMAIL'));
    await page.locator('#password').fill(env('E2E_ADMIN_PASSWORD'));
    await page.getByRole('button', { name: 'Entrar' }).click();
    // aguarda o redirecionamento pós-login
    await page.waitForURL(new RegExp(escapeRegExp('/admin')));
    await page.goto(env('E2E_COMMUNITY_PATH'));
    await page.getByRole('button', { name: 'Novo Agricultor' }).click();
    await page.getByRole('combobox', { name: 'Comunidade' }).click();
    await page.getByRole('option', { name: env('E2E_COMMUNITY_NAME') }).click();
    await page.getByLabel('Nome completo').fill(env('E2E_FARMER_NAME'));
    await page.getByLabel('E-mail').fill(env('E2E_FARMER_EMAIL'));
    await page.locator('#producer-password').fill(env('E2E_FARMER_PASSWORD'));
    await page.getByLabel('CPF').fill(env('E2E_FARMER_CPF'));
    await page.getByLabel('Data de nascimento').fill('1980-05-20');
    await page.getByLabel('Telefone').fill('82999990000');
    await page.getByLabel('Endereço/Nome local').fill('Sítio Boa Vista E2E');
    await page.getByLabel('Cidade').fill('Maceió');
    await page.getByLabel('UF').fill('AL');
    await page.getByLabel('Código IBGE').fill('2704302');
    await page.getByLabel('Latitude').fill('-9.66');
    await page.getByLabel('Longitude').fill('-35.73');
    await page.getByRole('button', { name: 'Cadastrar' }).click();
    await page.locator(`tr:has-text('${env('E2E_FARMER_NAME')}') button[aria-label='Editar agricultor']`).click();
    await page.getByLabel('Endereço/Nome local').fill('Sítio Editado E2E');
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(page.getByText('Sítio Editado E2E')).toBeVisible();
  });
});
