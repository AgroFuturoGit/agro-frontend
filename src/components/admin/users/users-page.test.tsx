import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UsersPage } from "@/components/admin/users/users-page";
import type { AuthUser } from "@/lib/auth";
import { listUsers } from "@/lib/users";

// Nenhum acesso de rede real: `listUsers` é mockado, o resto do módulo
// (ROLE_LABELS, ROLES, CREATABLE_ROLES, registerUser, adminUpdateUser,
// deleteUser) é preservado via `importActual`, pois `UserFormDrawer` e
// `DeleteUserDialog` também os consomem.
vi.mock("@/lib/users", async () => {
  const actual = await vi.importActual<typeof import("@/lib/users")>(
    "@/lib/users",
  );
  return {
    ...actual,
    listUsers: vi.fn(),
    registerUser: vi.fn(),
    adminUpdateUser: vi.fn(),
    deleteUser: vi.fn(),
  };
});

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>(
    "@/lib/auth",
  );
  return { ...actual, readUserFromStorage: vi.fn() };
});

const USERS: AuthUser[] = [
  {
    id: "user-1",
    fullName: "Ana Souza",
    email: "ana@agro.com",
    cpf: "11122233344",
    role: "ADMIN",
    dateOfBirth: "1990-01-15",
  },
  {
    id: "user-2",
    fullName: "Bruno Lima",
    email: "bruno@agro.com",
    cpf: "22233344455",
    role: "TECHNICIAN",
    dateOfBirth: "1988-05-20",
  },
  {
    id: "user-3",
    fullName: "Carla Dias",
    email: "carla@agro.com",
    cpf: "33344455566",
    role: "MANAGER",
    dateOfBirth: "1995-11-02",
  },
];

async function mockRole(role: AuthUser["role"] | null) {
  const auth = await import("@/lib/auth");
  vi.mocked(auth.readUserFromStorage).mockReturnValue(
    role
      ? {
          id: "current",
          fullName: "Usuário Atual",
          email: "atual@agro.com",
          cpf: "00000000000",
          role,
          dateOfBirth: null,
        }
      : null,
  );
}

async function mockUsers(users: AuthUser[]) {
  vi.mocked(listUsers).mockResolvedValue(users);
}

async function renderUsersPage() {
  const result = render(<UsersPage />);
  await screen.findByText(USERS[0].fullName);
  return result;
}

/** Item atualmente destacado no popup aberto do `Select`. */
function highlightedOption(): HTMLElement {
  const highlighted = screen
    .getAllByRole("option")
    .find((option) => option.getAttribute("data-highlighted") !== null);
  expect(highlighted).toBeTruthy();
  return highlighted as HTMLElement;
}

/**
 * O `Select` do `@base-ui/react` só confirma o item DESTACADO no jsdom —
 * abrimos "Filtros" (revela o combobox), navegamos pelo teclado até o
 * papel alvo e confirmamos com Enter (mesma técnica de
 * `data-table-toolbar.test.tsx`).
 *
 * Mantido em `fireEvent` de propósito, mesmo com o `user-event` disponível
 * no projeto: o caminho depende de navegar item a item pelo DESTAQUE
 * interno do `@base-ui/react`, lendo `highlightedOption()` entre cada
 * tecla. O `user-event` entrega uma sequência de teclado mais fiel ao
 * browser, mas não dá esse controle passo a passo — e é ele que faz o
 * teste funcionar no jsdom.
 */
async function selectRoleFilter(label: string) {
  fireEvent.click(screen.getByRole("button", { name: /Filtros/ }));

  const trigger = screen.getByLabelText("Papel");
  trigger.focus();
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  fireEvent.keyUp(trigger, { key: "ArrowDown" });

  const target = await screen.findByRole("option", { name: label });
  const options = screen.getAllByRole("option");
  const from = options.indexOf(highlightedOption());
  const to = options.indexOf(target);

  const key = to > from ? "ArrowDown" : "ArrowUp";
  for (let step = 0; step < Math.abs(to - from); step += 1) {
    const current = highlightedOption();
    fireEvent.keyDown(current, { key });
    fireEvent.keyUp(current, { key });
  }

  const highlighted = document.activeElement as HTMLElement;
  fireEvent.keyDown(highlighted, { key: "Enter" });
  fireEvent.keyUp(highlighted, { key: "Enter" });
}

describe("UsersPage — RBAC", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("role=ADMIN: exibe botão 'Novo usuário' e coluna 'Ações'", async () => {
    await mockRole("ADMIN");
    await mockUsers(USERS);

    await renderUsersPage();

    expect(screen.getByRole("button", { name: /Novo usuário/ })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Ações" })).toBeTruthy();
  });

  it("role=MANAGER: não exibe 'Novo usuário' nem coluna 'Ações'", async () => {
    await mockRole("MANAGER");
    await mockUsers(USERS);

    await renderUsersPage();

    expect(screen.queryByRole("button", { name: /Novo usuário/ })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Ações" })).toBeNull();
  });
});

describe("UsersPage — filtro por papel", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("selecionar um papel no filtro reduz a lista ao papel escolhido", async () => {
    await mockRole("ADMIN");
    await mockUsers(USERS);

    await renderUsersPage();

    await selectRoleFilter("Técnico");

    await waitFor(() => {
      expect(screen.getByText("Bruno Lima")).toBeTruthy();
      expect(screen.queryByText("Ana Souza")).toBeNull();
      expect(screen.queryByText("Carla Dias")).toBeNull();
    });
  });
});

describe("UsersPage — busca livre", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("digitar um nome no campo de busca filtra a lista após o debounce", async () => {
    await mockRole("ADMIN");
    await mockUsers(USERS);

    await renderUsersPage();

    vi.useFakeTimers({ shouldAdvanceTime: true });
    // `user-event` espera o relógio andar entre as teclas; com timers
    // falsos ele travaria sem este `advanceTimers`.
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    const input = screen.getByPlaceholderText("Buscar por nome, e-mail ou CPF…");
    await user.type(input, "Bruno");

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    vi.useRealTimers();

    await waitFor(() => {
      expect(screen.getByText("Bruno Lima")).toBeTruthy();
      expect(screen.queryByText("Ana Souza")).toBeNull();
      expect(screen.queryByText("Carla Dias")).toBeNull();
    });
  });
});

describe("UsersPage — integração com UserFormDrawer e DeleteUserDialog", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("clicar em 'Editar' abre o drawer em modo edit com os campos do usuário certo pré-preenchidos", async () => {
    const user = userEvent.setup();
    await mockRole("ADMIN");
    await mockUsers(USERS);

    await renderUsersPage();

    await user.click(
      screen.getAllByRole("button", { name: "Editar usuário" })[0],
    );

    expect(await screen.findByText("Editar usuário")).toBeTruthy();
    expect(screen.getByDisplayValue("Ana Souza")).toBeTruthy();
    expect(screen.getByDisplayValue("ana@agro.com")).toBeTruthy();
  });

  it("clicar em 'Excluir' abre o DeleteUserDialog com o usuário certo", async () => {
    const user = userEvent.setup();
    await mockRole("ADMIN");
    await mockUsers(USERS);

    await renderUsersPage();

    const deleteButtons = screen.getAllByRole("button", {
      name: "Excluir usuário",
    });
    await user.click(deleteButtons[0]);

    expect(await screen.findByText("Excluir usuário")).toBeTruthy();
    expect(
      screen.getByText((_, node) => node?.textContent === "Esta ação removerá Ana Souza do sistema. Não é possível desfazer."),
    ).toBeTruthy();
  });
});
