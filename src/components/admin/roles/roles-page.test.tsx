import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RolesPage } from "./roles-page";

const mocks = vi.hoisted(() => ({
  isMobile: true,
  listRoles: vi.fn(),
}));

vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => mocks.isMobile }));
vi.mock("@/lib/roles", () => ({ listRoles: mocks.listRoles }));

describe("RolesPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    mocks.isMobile = true;
    mocks.listRoles.mockReset();
    mocks.listRoles.mockResolvedValue([
      { name: "ADMIN", description: "Administrador do sistema" },
      { name: "FARMER", description: "Produtor rural" },
    ]);
  });

  it("mostra cartões no celular, sem tabela, com o mesmo conteúdo", async () => {
    render(<RolesPage />);

    expect(await screen.findByText("Administrador")).toBeInTheDocument();
    expect(screen.getByText("ADMIN")).toBeInTheDocument();
    expect(screen.getByText("Administrador do sistema")).toBeInTheDocument();
    expect(screen.getByText("Agricultor")).toBeInTheDocument();
    expect(screen.getByText("FARMER")).toBeInTheDocument();
    expect(screen.getByText("Produtor rural")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("mostra mensagem vazia nos cartões", async () => {
    mocks.listRoles.mockResolvedValue([]);
    render(<RolesPage />);

    expect(await screen.findByText("Nenhum perfil disponível.")).toBeInTheDocument();
  });

  it("mostra a tabela no desktop", async () => {
    mocks.isMobile = false;
    render(<RolesPage />);

    await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());
    expect(await screen.findByText("Produtor rural")).toBeInTheDocument();
  });

  it("título em PageHeader (h2), sem fonte mono no identificador", async () => {
    mocks.isMobile = false;
    render(<RolesPage />);

    expect(screen.getByRole("heading", { level: 2, name: "Perfis" })).toBeInTheDocument();
    const id = await screen.findByText("FARMER");
    expect(id.closest("td")?.className).toMatch(/\btext-muted-foreground\b/);
    expect(id.closest("table")?.innerHTML).not.toMatch(/font-mono|uppercase/);
  });

  it("vazio no desktop: estado vazio com orientação dentro do card da tabela", async () => {
    mocks.isMobile = false;
    mocks.listRoles.mockResolvedValue([]);
    render(<RolesPage />);

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("Nenhum perfil disponível.");
    expect(status).toHaveTextContent(/definidos pelo backend/);
  });

  it("erro: alerta com a mensagem e 'Tentar novamente' recarrega", async () => {
    mocks.isMobile = false;
    mocks.listRoles.mockRejectedValueOnce(new Error("falha"));
    render(<RolesPage />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Não foi possível carregar os dados.");
    // Mesma dica padrão das outras listas (sem a mensagem técnica da API).
    expect(alert).toHaveTextContent("Tente novamente em alguns instantes.");
    expect(screen.queryByText("Nenhum perfil disponível.")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("Produtor rural")).toBeInTheDocument();
    expect(mocks.listRoles).toHaveBeenCalledTimes(2);
  });
});
