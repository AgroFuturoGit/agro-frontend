import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UserFormDrawer } from "@/components/admin/users/user-form-drawer";
import { createTechnician } from "@/lib/technicians";
import { adminUpdateUser, registerUser, type User } from "@/lib/users";

// Nenhum acesso de rede real: `registerUser`/`adminUpdateUser` são
// mockados, o resto do módulo (ROLE_LABELS, ROLES, CREATABLE_ROLES) é
// preservado via `importActual`, pois o próprio componente os consome
// para montar o Select de papel — mesmo padrão de `users-page.test.tsx`.
vi.mock("@/lib/users", async () => {
  const actual = await vi.importActual<typeof import("@/lib/users")>(
    "@/lib/users",
  );
  return {
    ...actual,
    registerUser: vi.fn(),
    adminUpdateUser: vi.fn(),
  };
});

vi.mock("@/lib/technicians", () => ({
  TECHNICIAN_REGISTRATION_TYPES: ["CREA", "CFT", "CFTA"],
  createTechnician: vi.fn(),
}));

// `readUserFromStorage` real acessa `localStorage` global, indisponível
// neste ambiente jsdom/Vitest (mesma causa raiz contornada em
// `users-page.test.tsx`) — mockado para não estourar no submit do modo
// `edit`, que o consulta para atualizar a sessão local após salvar.
vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>(
    "@/lib/auth",
  );
  return { ...actual, readUserFromStorage: vi.fn() };
});

const USER: User = {
  id: "u1",
  fullName: "Ana Souza",
  email: "ana@agro.com",
  cpf: "11122233344",
  role: "TECHNICIAN",
};

/**
 * O `Select` do `@base-ui/react` só confirma o item DESTACADO no jsdom —
 * abrir por clique direto não é suficiente. Abrimos o combobox pelo
 * teclado (mesma técnica de `data-table-toolbar.test.tsx` e
 * `users-page.test.tsx`); aqui só precisamos ler a lista de opções, sem
 * navegar até um alvo nem confirmar com Enter.
 *
 * Mantido em `fireEvent` de propósito, mesmo com o `user-event` disponível
 * no projeto: o caminho depende de navegar item a item pelo DESTAQUE
 * interno do `@base-ui/react`, lendo `highlightedOption()` entre cada
 * tecla. O `user-event` entrega uma sequência de teclado mais fiel ao
 * browser, mas não dá esse controle passo a passo — e é ele que faz o
 * teste funcionar no jsdom.
 */
function openRoleSelect() {
  const trigger = screen.getByLabelText("Papel");
  trigger.focus();
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  fireEvent.keyUp(trigger, { key: "ArrowDown" });
  return trigger;
}

describe("UserFormDrawer — modo create", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("modo create: Select de papel lista apenas CREATABLE_ROLES (ADMIN, TECHNICIAN)", async () => {
    render(
      <UserFormDrawer mode="create" open onOpenChange={() => {}} onSaved={() => {}} />,
    );

    openRoleSelect();

    const options = await screen.findAllByRole("option");
    const labels = options.map((o) => o.textContent);

    expect(labels).toEqual(["Administrador", "Técnico"]); // CREATABLE_ROLES
    expect(labels).not.toContain("Gerente");
    expect(labels).not.toContain("Agricultor");
  });
});

const VALID_CPF = "529.982.247-25";

function highlightedOption(): HTMLElement {
  const highlighted = screen
    .getAllByRole("option")
    .find((option) => option.getAttribute("data-highlighted") !== null);
  expect(highlighted).toBeTruthy();
  return highlighted as HTMLElement;
}

/** Escolhe uma opção do `Select` navegando pelo teclado (ver `openRoleSelect`). */
async function selectOption(triggerLabel: string, optionLabel: string) {
  const trigger = screen.getByLabelText(triggerLabel);
  trigger.focus();
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  fireEvent.keyUp(trigger, { key: "ArrowDown" });

  const target = await screen.findByRole("option", { name: optionLabel });
  const options = screen.getAllByRole("option");
  const from = options.indexOf(highlightedOption());
  const to = options.indexOf(target);
  const key = to > from ? "ArrowDown" : "ArrowUp";
  for (let step = 0; step < Math.abs(to - from); step += 1) {
    const current = highlightedOption();
    fireEvent.keyDown(current, { key });
    fireEvent.keyUp(current, { key });
  }
  const active = document.activeElement as HTMLElement;
  fireEvent.keyDown(active, { key: "Enter" });
  fireEvent.keyUp(active, { key: "Enter" });
}

async function pickRole(label: string) {
  await selectOption("Papel", label);
}

function fillBase() {
  fireEvent.change(screen.getByLabelText("Nome completo"), {
    target: { value: "Tânia Técnica" },
  });
  fireEvent.change(screen.getByLabelText("E-mail"), {
    target: { value: "tania@agro.com" },
  });
  fireEvent.change(screen.getByLabelText("Senha"), {
    target: { value: "Senha@123" },
  });
}

function submit() {
  fireEvent.submit(document.querySelector("form") as HTMLFormElement);
}

describe("UserFormDrawer — criação por perfil (BR-007/BR-008)", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("UNIT-007: não pede data de nascimento e o CPF do Administrador é opcional", () => {
    render(
      <UserFormDrawer mode="create" open onOpenChange={() => {}} onSaved={() => {}} />,
    );

    expect(screen.queryByLabelText("Data de nascimento")).toBeNull();
    expect(screen.getByLabelText("CPF (opcional)")).not.toBeRequired();
    expect(screen.queryByLabelText("Tipo de registro")).toBeNull();
  });

  it("UNIT-006: Administrador sem CPF chama registerUser sem cpf nem dateOfBirth", async () => {
    vi.mocked(registerUser).mockResolvedValue({ ...USER, role: "ADMIN" });
    const onSaved = vi.fn();
    render(
      <UserFormDrawer mode="create" open onOpenChange={() => {}} onSaved={onSaved} />,
    );

    fillBase();
    submit();

    await waitFor(() =>
      expect(registerUser).toHaveBeenCalledExactlyOnceWith({
        fullName: "Tânia Técnica",
        email: "tania@agro.com",
        password: "Senha@123",
        role: "ADMIN",
      }),
    );
    expect(createTechnician).not.toHaveBeenCalled();
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  });

  it("UNIT-006: Técnico mostra CPF obrigatório e campos de registro e chama createTechnician", async () => {
    vi.mocked(createTechnician).mockResolvedValue({
      id: "t1",
      user: null,
      registrationType: "CREA",
      registrationNumber: "123",
      specialty: "Agronomia",
    });
    const onSaved = vi.fn();
    render(
      <UserFormDrawer mode="create" open onOpenChange={() => {}} onSaved={onSaved} />,
    );

    await pickRole("Técnico");
    expect(await screen.findByLabelText("Tipo de registro")).toBeTruthy();
    expect(screen.getByLabelText("CPF")).toBeRequired();
    fillBase();
    fireEvent.change(screen.getByLabelText("CPF"), { target: { value: VALID_CPF } });
    fireEvent.change(screen.getByLabelText("Número do registro"), {
      target: { value: "123" },
    });
    fireEvent.change(screen.getByLabelText("Especialidade"), {
      target: { value: "Agronomia" },
    });
    await selectOption("Tipo de registro", "CREA");
    submit();

    await waitFor(() =>
      expect(createTechnician).toHaveBeenCalledExactlyOnceWith({
        fullName: "Tânia Técnica",
        email: "tania@agro.com",
        password: "Senha@123",
        cpf: VALID_CPF,
        registrationType: "CREA",
        registrationNumber: "123",
        specialty: "Agronomia",
      }),
    );
    expect(registerUser).not.toHaveBeenCalled();
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  });

  it("UNIT-007: Técnico sem CPF ou com número sem tipo não chama a API", async () => {
    render(
      <UserFormDrawer mode="create" open onOpenChange={() => {}} onSaved={() => {}} />,
    );

    await pickRole("Técnico");
    await screen.findByLabelText("Tipo de registro");
    fillBase();
    fireEvent.change(screen.getByLabelText("Número do registro"), {
      target: { value: "123" },
    });
    submit();

    expect(await screen.findByText("Informe o CPF")).toBeTruthy();
    expect(screen.getByText("Informe o tipo do registro")).toBeTruthy();
    expect(createTechnician).not.toHaveBeenCalled();
    expect(registerUser).not.toHaveBeenCalled();
  });

  it("UNIT-007: Técnico com tipo sem número também é bloqueado", async () => {
    render(
      <UserFormDrawer mode="create" open onOpenChange={() => {}} onSaved={() => {}} />,
    );

    await pickRole("Técnico");
    await screen.findByLabelText("Tipo de registro");
    fillBase();
    fireEvent.change(screen.getByLabelText("CPF"), { target: { value: VALID_CPF } });
    await selectOption("Tipo de registro", "CFT");
    submit();

    expect(await screen.findByText("Informe o número do registro")).toBeTruthy();
    expect(createTechnician).not.toHaveBeenCalled();
  });
});

describe("UserFormDrawer — modo edit", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("modo edit: email e cpf ficam readOnly/disabled; Select de papel lista as 4 ROLES", async () => {
    render(
      <UserFormDrawer mode="edit" user={USER} open onOpenChange={() => {}} onSaved={() => {}} />,
    );

    const email = (await screen.findByLabelText("E-mail")) as HTMLInputElement;
    const cpf = screen.getByLabelText("CPF") as HTMLInputElement;
    expect(email.readOnly).toBe(true);
    expect(email.disabled).toBe(true);
    expect(cpf.readOnly).toBe(true);
    expect(cpf.disabled).toBe(true);

    openRoleSelect();

    const options = await screen.findAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      "Administrador",
      "Gerente",
      "Técnico",
      "Agricultor",
    ]);
  });

  it("modo edit: submeter chama adminUpdateUser só com fullName/role, sem email/cpf/dateOfBirth", async () => {
    const user = userEvent.setup();
    vi.mocked(adminUpdateUser).mockResolvedValue({
      ...USER,
      fullName: "Ana Souza Silva",
    });
    const onSaved = vi.fn();

    render(
      <UserFormDrawer mode="edit" user={USER} open onOpenChange={() => {}} onSaved={onSaved} />,
    );

    const fullName = screen.getByLabelText("Nome completo");
    await user.clear(fullName);
    await user.type(fullName, "Ana Souza Silva");
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => {
      expect(adminUpdateUser).toHaveBeenCalledWith("u1", {
        fullName: "Ana Souza Silva",
        role: "TECHNICIAN",
      });
      expect(onSaved).toHaveBeenCalledTimes(1);
    });
  });
});

/**
 * Sobe do campo até o `<form>` procurando um contêiner com padding
 * horizontal.
 *
 * Guarda a regressão corrigida em `ec8c2e9` (issue #23): o `<form>` não
 * tinha padding horizontal e os campos ficavam colados na borda do drawer,
 * enquanto `SheetHeader` e `SheetFooter` já vinham com `p-4` do próprio
 * `ui/sheet`. Percorrer a cadeia de ancestrais em vez de fixar a
 * profundidade exata da árvore deixa o teste sobreviver a um wrapper a
 * mais, mas ainda falhar se o padding sumir.
 */
function paddedAncestor(field: HTMLElement, form: HTMLElement) {
  for (
    let node: HTMLElement | null = field;
    node && node !== form.parentElement;
    node = node.parentElement
  ) {
    if (typeof node.className === "string" && /\b(px-4|p-4)\b/.test(node.className)) {
      return node;
    }
  }
  return null;
}

describe("UserFormDrawer — layout interno", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("campos ficam dentro de um contêiner com padding horizontal, e não colados na borda do drawer", async () => {
    render(
      <UserFormDrawer mode="edit" user={USER} open onOpenChange={() => {}} onSaved={() => {}} />,
    );

    const field = await screen.findByLabelText("Nome completo");
    const form = field.closest("form");
    expect(form).not.toBeNull();

    const container = paddedAncestor(field, form as HTMLElement);
    expect(container).not.toBeNull();
    expect(container).toContainElement(field);
    // Alinha com o `p-4` que SheetHeader e SheetFooter já aplicam.
    expect(container!.className).toMatch(/\bpx-4\b/);
  });

  it("o mesmo contêiner envolve todos os campos do formulário, não só o primeiro", async () => {
    render(
      <UserFormDrawer mode="edit" user={USER} open onOpenChange={() => {}} onSaved={() => {}} />,
    );

    const form = (await screen.findByLabelText("Nome completo")).closest(
      "form",
    ) as HTMLElement;

    const containers = ["Nome completo", "E-mail", "CPF"].map((label) =>
      paddedAncestor(screen.getByLabelText(label), form),
    );

    expect(containers.every(Boolean)).toBe(true);
    expect(new Set(containers).size).toBe(1);
  });
});
