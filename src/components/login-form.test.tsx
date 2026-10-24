import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh: vi.fn() }),
}));
vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  apiRequest: vi.fn().mockResolvedValue({
    token: "t",
    userResponseDTO: {
      id: "1",
      fullName: "A",
      email: "a@x.com",
      cpf: "1",
      role: "ADMIN",
      dateOfBirth: null,
    },
  }),
}));

import { LoginForm } from "@/components/login-form";

// O Node recente expõe um `localStorage` global próprio que sobrepõe o do jsdom
// (indefinido sem --localstorage-file): troca por um armazenamento em memória.
function installMemoryStorage() {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  });
}

async function submitWith(search: string) {
  window.history.replaceState({}, "", `/login${search}`);
  render(<LoginForm />);
  await userEvent.type(screen.getByLabelText("E-mail"), "a@x.com");
  await userEvent.type(document.querySelector("#password")!, "12345678");
  await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
}

beforeEach(() => {
  installMemoryStorage();
  replace.mockClear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("LoginForm retorno ao from (UNIT-003)", () => {
  it("volta para from interno", async () => {
    await submitWith("?from=%2Fadmin%2Fusuarios");
    expect(replace).toHaveBeenCalledWith("/admin/usuarios");
  });

  it("ignora from externo", async () => {
    await submitWith("?from=https%3A%2F%2Fevil.com");
    expect(replace).toHaveBeenCalledWith("/admin");
  });

  it("ignora from começando com //", async () => {
    await submitWith("?from=%2F%2Fevil.com%2Fadmin");
    expect(replace).toHaveBeenCalledWith("/admin");
  });

  it("sem from vai para /admin", async () => {
    await submitWith("");
    expect(replace).toHaveBeenCalledWith("/admin");
  });
});
