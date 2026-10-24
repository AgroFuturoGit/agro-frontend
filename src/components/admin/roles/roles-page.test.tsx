import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
});
