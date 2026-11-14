import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import * as auth from "@/lib/auth";

import AdminLayout from "./layout";

vi.mock("next/navigation", async () => {
  const { navigationMockModule } = await import("@/test/next-navigation");
  return navigationMockModule;
});

// O shell monta o SessionRefresher (GET /auth/me): fora do escopo deste teste.
vi.mock("@/components/admin/session-refresher", () => ({
  SessionRefresher: () => null,
}));

beforeAll(() => {
  window.matchMedia =
    window.matchMedia ??
    ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }));
});

function renderShell() {
  vi.spyOn(auth, "readUserFromStorage").mockReturnValue(null);
  vi.spyOn(auth, "getUserSnapshot").mockReturnValue(null);
  vi.spyOn(auth, "subscribeUserStorage").mockReturnValue(() => {});
  return render(
    <AdminLayout>
      <p>Conteúdo da página</p>
    </AdminLayout>,
  );
}

describe("AdminLayout — landmarks e skip link", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("tem um único <main>, com o id do skip link e só o conteúdo da página", () => {
    const { container } = renderShell();

    const mains = container.querySelectorAll("main");
    expect(mains).toHaveLength(1);
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "conteudo-principal");
    expect(main).toHaveAttribute("tabindex", "-1");
    expect(main).toHaveTextContent("Conteúdo da página");
    // O header (gatilho da sidebar, h1 e menu do usuário) fica fora do main.
    expect(main.querySelector("header")).toBeNull();
    expect(
      screen.getByRole("link", { name: "Pular para o conteúdo" }),
    ).toHaveAttribute("href", "#conteudo-principal");
  });

  it("header fora do main vira o landmark banner", () => {
    renderShell();

    const banner = screen.getByRole("banner");
    expect(
      within(banner).getByRole("heading", { level: 1, name: "Painel administrativo" }),
    ).toBeInTheDocument();
  });

  it("navegação principal num <nav> rotulado", () => {
    renderShell();

    const nav = screen.getByRole("navigation", { name: "Navegação principal" });
    expect(within(nav).getByRole("link", { name: /Visão geral/ })).toBeInTheDocument();
  });

  it("link do logo tem nome acessível mesmo com a sidebar recolhida", () => {
    renderShell();

    expect(
      screen.getByRole("link", { name: "ProduPlan — Visão geral" }),
    ).toHaveAttribute("href", "/admin");
  });

  it("conteúdo usa o espaçamento entre seções do token", () => {
    renderShell();

    expect(screen.getByRole("main")).toHaveClass("flex", "flex-col", "gap-section");
  });
});
