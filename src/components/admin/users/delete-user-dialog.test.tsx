import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DeleteUserDialog } from "@/components/admin/users/delete-user-dialog";
import { ApiError, apiRequest } from "@/lib/api";
import type { User } from "@/lib/users";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, apiRequest: vi.fn() };
});

const BASE: User = {
  id: "user-1",
  fullName: "Bruno Lima",
  email: "bruno@agro.com",
  cpf: "22233344455",
  role: "ADMIN",
};

function renderDialog(role: User["role"]) {
  const onDeleted = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <DeleteUserDialog
      user={{ ...BASE, role }}
      open
      onOpenChange={onOpenChange}
      onDeleted={onDeleted}
    />,
  );
  return { onDeleted, onOpenChange };
}

/** Só as chamadas que escrevem; a busca do perfil em `GET /technicians` não conta. */
function deleteCalls() {
  return vi
    .mocked(apiRequest)
    .mock.calls.filter(([, options]) => options?.method === "DELETE")
    .map(([path]) => path);
}

beforeEach(() => {
  vi.mocked(apiRequest).mockReset();
  vi.mocked(apiRequest).mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("DeleteUserDialog", () => {
  it("ADMIN: exclui pela rota de usuário", async () => {
    const { onDeleted } = renderDialog("ADMIN");

    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(deleteCalls()).toEqual(["/users/user-1"]);
  });

  it("TECHNICIAN: exclui pela rota do perfil, encontrado pelo id do usuário", async () => {
    vi.mocked(apiRequest).mockImplementation(async (path) =>
      path === "/technicians"
        ? [
            { id: "tech-9", user: { id: "outro" } },
            { id: "tech-1", user: { id: "user-1" } },
          ]
        : undefined,
    );
    const { onDeleted } = renderDialog("TECHNICIAN");

    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(deleteCalls()).toEqual(["/technicians/tech-1"]);
  });

  it("TECHNICIAN sem perfil: cai na rota de usuário", async () => {
    vi.mocked(apiRequest).mockImplementation(async (path) =>
      path === "/technicians" ? [] : undefined,
    );
    const { onDeleted } = renderDialog("TECHNICIAN");

    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(deleteCalls()).toEqual(["/users/user-1"]);
  });

  it("TECHNICIAN: mostra o erro do back e não exclui quando a busca falha", async () => {
    vi.mocked(apiRequest).mockRejectedValue(new ApiError(500, "Falha ao listar", null));
    const { onDeleted } = renderDialog("TECHNICIAN");

    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Falha ao listar");
    expect(onDeleted).not.toHaveBeenCalled();
    expect(deleteCalls()).toEqual([]);
  });

  it.each([
    ["FARMER", /na tela da comunidade/],
    ["MANAGER", /ainda não permite excluir gestores/],
  ] as const)("%s: explica o motivo e não oferece a exclusão", (role, reason) => {
    renderDialog(role);

    expect(screen.getByText(reason)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Excluir" })).toBeNull();
    expect(screen.getByRole("button", { name: "Fechar" })).toBeTruthy();
    expect(apiRequest).not.toHaveBeenCalled();
  });
});
