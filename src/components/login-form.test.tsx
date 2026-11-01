import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
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

import { ApiError, apiRequest } from "@/lib/api";
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

  it.each([
    ["barra invertida", "%5C%5Cevil.com"],
    ["/admin com barra invertida", "%2Fadmin%5Cevil"],
    ["/adminx", "%2Fadminx"],
    ["/admin/..//evil.com", "%2Fadmin%2F..%2F%2Fevil.com"],
    ["esquema javascript", "javascript%3Aalert(1)"],
  ])("recusa from de risco: %s", async (_label, encoded) => {
    await submitWith(`?from=${encoded}`);
    expect(replace).toHaveBeenCalledWith("/admin");
  });

  it("sem from vai para /admin", async () => {
    await submitWith("");
    expect(replace).toHaveBeenCalledWith("/admin");
  });
});

describe("LoginForm com limite de tentativas 429 (UNIT-004)", () => {
  const LIMIT_MESSAGE =
    "Limite de tentativas de login excedido. Tente novamente mais tarde.";

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  async function submit429(retryAfterSeconds: number | null) {
    vi.mocked(apiRequest).mockRejectedValueOnce(
      new ApiError(429, LIMIT_MESSAGE, { message: LIMIT_MESSAGE }, retryAfterSeconds),
    );
    window.history.replaceState({}, "", "/login");
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText("E-mail"), "a@x.com");
    await userEvent.type(document.querySelector("#password")!, "12345678");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
  }

  it("mostra a mensagem do back com a contagem e bloqueia o botão até zerar", async () => {
    await submit429(3);
    expect(await screen.findByText(/Limite de tentativas de login excedido/)).toBeTruthy();
    expect(screen.getByText(/Tente novamente em 3 s\./)).toBeTruthy();
    const button = screen.getByRole("button", { name: "Entrar" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.getByText(/Tente novamente em 2 s\./)).toBeTruthy();
    expect(button.disabled).toBe(true);

    for (let i = 0; i < 2; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
    }
    expect(screen.queryByText(/Tente novamente em/)).toBeNull();
    expect((screen.getByRole("button", { name: "Entrar" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("anuncia o tempo uma vez em região polite e esconde a contagem visual", async () => {
    await submit429(30);
    const notice = await screen.findByText("Tente novamente em cerca de 30 segundos.");
    expect(notice.closest('[aria-live="polite"]')).not.toBeNull();
    expect(screen.getByText(/Tente novamente em 30 s\./).getAttribute("aria-hidden")).toBe("true");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.getAllByText("Tente novamente em cerca de 30 segundos.")).toHaveLength(1);
  });

  it("sem Retry-After anuncia 'cerca de 1 minuto' e espera 60 s", async () => {
    await submit429(null);
    expect(await screen.findByText("Aguarde cerca de 1 minuto e tente novamente.")).toBeTruthy();
    expect(await screen.findByText(/Tente novamente em 60 s\./)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Entrar" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("outros erros não bloqueiam o botão", async () => {
    vi.mocked(apiRequest).mockRejectedValueOnce(new ApiError(401, "Credenciais inválidas", null));
    window.history.replaceState({}, "", "/login");
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText("E-mail"), "a@x.com");
    await userEvent.type(document.querySelector("#password")!, "12345678");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByText("Credenciais inválidas")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Entrar" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
