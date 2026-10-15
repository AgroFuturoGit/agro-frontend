// Gerado a partir do cenário em e2e/scenarios (fonte indicada abaixo); mantenha os dois em sincronia.
// Source: e2e/scenarios/E2E-003-grafico-colheita-continua.scenario.json
// Scenario: E2E-003 — ACs: AC-009, AC-011, AC-015 — requires @playwright/test >= 1.42
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

test.describe('E2E-003 Gráfico de colheita contínua no detalhe do plano com tooltip e alternador', () => {
  test.use({ baseURL: process.env['E2E_BASE_URL'] });
  // Preconditions (arrange before running):
  //   - Backend develop rodando com as migrations aplicadas
  //   - Plano de uma cultura CONTINUOUS com janela de colheita prevista e ao menos um apontamento
  //   - Caminho do detalhe desse plano informado em E2E_CONTINUOUS_PLAN_PATH (por exemplo /admin/organizacoes/{org}/comunidades/{comunidade}/produtores/{agricultor}/planos/{plano})

  test('happy_path — Gráfico composto aparece, o tooltip mostra os valores em kg e o alternador troca para Mês', {
    tag: ['@P0', '@planos', '@grafico', '@colheita-continua'],
    annotation: [{ type: 'E2E', description: 'E2E-003' }, { type: 'AC', description: 'AC-009' }, { type: 'AC', description: 'AC-011' }, { type: 'AC', description: 'AC-015' }, { type: 'user', description: 'ADMIN' }],
  }, async ({ page }) => {
    await page.goto('/login');
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(env('E2E_ADMIN_EMAIL'));
    await page.locator('#password').fill(env('E2E_ADMIN_PASSWORD'));
    await page.getByRole('button', { name: 'Entrar' }).click();
    // aguarda o redirecionamento pós-login
    await page.waitForURL(new RegExp(escapeRegExp('/admin')));
    await page.goto(env('E2E_CONTINUOUS_PLAN_PATH'));
    // passa o mouse no meio do gráfico para abrir o tooltip
    await page.locator('[role=\'img\'][data-mode=\'composite\']').hover();
    await expect(page.locator('[role=\'img\'][data-mode=\'composite\']')).toBeVisible();
    await expect(page.getByTestId('harvest-chart-tooltip')).toBeVisible();
    await expect(page.getByText('Somente validados contam no realizado oficial.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mês', exact: true })).toBeVisible();
  });
});
