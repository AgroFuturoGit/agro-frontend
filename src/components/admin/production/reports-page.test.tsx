import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api";
import { getMyProducer } from "@/lib/producers";
import { getProductionComparison, listProductionPlans } from "@/lib/production";

import { ReportsPage } from "./reports-page";

vi.mock("@/lib/producers", async () => {
  const actual = await vi.importActual<typeof import("@/lib/producers")>("@/lib/producers");
  return { ...actual, getMyProducer: vi.fn() };
});
vi.mock("@/lib/production", async () => {
  const actual = await vi.importActual<typeof import("@/lib/production")>("@/lib/production");
  return { ...actual, listProductionPlans: vi.fn(), getProductionComparison: vi.fn() };
});

const plan = (id: string, name: string) =>
  ({
    id,
    crop: { name, variety: "Comum" },
    harvest: { label: "2026" },
    expectedYield: 1000,
  }) as never;

beforeEach(() => {
  vi.mocked(getMyProducer).mockResolvedValue({
    id: "f-1",
    community: { id: "com-1", organization: { id: "org-1" } },
  } as never);
  vi.mocked(listProductionPlans).mockResolvedValue([plan("p-1", "Milho"), plan("p-2", "Feijão")]);
  vi.mocked(getProductionComparison).mockImplementation(async (id: string) => {
    if (id === "p-2") throw new Error("x");
    return {
      productionPlanId: id,
      expectedYield: 1000,
      totalActualYield: 400,
      difference: -600,
      percentageRealized: 40,
    };
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ReportsPage", () => {
  it("cabeçalho, consolidado, barra de progresso e 'Ver detalhes' com o link do plano", async () => {
    render(<ReportsPage />);
    expect(screen.getByRole("heading", { level: 2, name: "Relatórios" })).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "Consolidado" })).toBeTruthy();
    expect(screen.getByText("Soma de 1 plano de produção.")).toBeTruthy();
    const bar = screen.getByRole("progressbar", {
      name: "Progresso de Milho — Comum em relação à meta",
    });
    expect(bar.getAttribute("aria-valuenow")).toBe("40");
    const links = screen.getAllByRole("link", { name: /Ver detalhes/ });
    expect(links).toHaveLength(2);
    expect(links[0].getAttribute("href")).toBe(
      "/admin/organizacoes/org-1/comunidades/com-1/produtores/f-1/planos/p-1",
    );
    expect(links[0].textContent).toContain("safra 2026");
    expect(screen.getByText("Comparativo indisponível.")).toBeTruthy();
    // O texto da barra diz qual número é qual (as barras são decorativas).
    expect(screen.getByText("Realizado 400 kg de 1.000 kg previstos")).toBeTruthy();
  });

  it("sem comunidade/organização não mostra 'Ver detalhes' (não leva a rota proibida)", async () => {
    vi.mocked(getMyProducer).mockResolvedValue({ id: "f-1", community: null } as never);
    render(<ReportsPage />);
    await screen.findByRole("heading", { name: "Consolidado" });
    expect(screen.queryByRole("link", { name: /Ver detalhes/ })).toBeNull();
  });

  it("sem planos mostra o vazio com o CTA para os planos", async () => {
    vi.mocked(listProductionPlans).mockResolvedValue([]);
    render(<ReportsPage />);
    const empty = await screen.findByRole("status");
    expect(within(empty).getByText("Nenhum plano de produção para exibir")).toBeTruthy();
    expect(
      within(empty).getByRole("link", { name: "Ir para os meus planos" }).getAttribute("href"),
    ).toBe("/admin/organizacoes/org-1/comunidades/com-1/produtores/f-1");
  });

  it("erro na primeira carga: alerta sem vazio falso, sem 'Erro 500' cru, e 'Tentar novamente' recupera", async () => {
    vi.mocked(getMyProducer)
      .mockRejectedValueOnce(new ApiError(500, "Erro 500", null))
      .mockResolvedValue({
        id: "f-1",
        community: { id: "com-1", organization: { id: "org-1" } },
      } as never);
    render(<ReportsPage />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Não foi possível carregar os relatórios.");
    expect(alert.textContent).not.toContain("Erro 500");
    expect(screen.queryByText("Nenhum plano de produção para exibir")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByRole("heading", { name: "Consolidado" })).toBeTruthy();
  });

  it("carregando: região nomeada com o skeleton do consolidado, sem vazio nem alerta", () => {
    vi.mocked(getMyProducer).mockReturnValue(new Promise(() => {}));
    render(<ReportsPage />);
    const region = screen.getByRole("region", { name: "Carregando relatórios" });
    expect(region.getAttribute("aria-busy")).toBe("true");
    expect(within(region).getByText("Carregando Previsto")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Consolidado" })).toBeNull();
  });

  it("A11Y-L5-8/9: 'da meta' em 16px; título do card em até 2 linhas e linha do gráfico com title", async () => {
    render(<ReportsPage />);
    await screen.findByRole("heading", { name: "Consolidado" });
    expect(screen.getAllByText("da meta")[0].className).toContain("text-base");
    const titles = screen.getAllByText("Milho — Comum");
    const chartLabel = titles.find((t) => t.getAttribute("title") === "Milho — Comum");
    expect(chartLabel?.className).toContain("truncate");
    expect(titles.some((t) => t.className.includes("line-clamp-2"))).toBe(true);
  });
});
