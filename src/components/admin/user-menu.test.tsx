import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as auth from "@/lib/auth";

import { UserMenu } from "./user-menu";

vi.mock("next/navigation", async () => {
  const { navigationMockModule } = await import("@/test/next-navigation");
  return navigationMockModule;
});

function mockUser(user: auth.AuthUser | null) {
  vi.spyOn(auth, "subscribeUserStorage").mockReturnValue(() => {});
  vi.spyOn(auth, "getUserSnapshot").mockReturnValue(user);
}

describe("UserMenu — nome do gatilho (A11Y-11)", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("descreve a função e inclui o nome visível do usuário", () => {
    mockUser({
      id: "1",
      fullName: "Adriana Admin",
      email: "a@agro.com",
      cpf: "00000000000",
      role: "ADMIN",
      dateOfBirth: null,
    });
    render(<UserMenu />);

    expect(
      screen.getByRole("button", { name: "Menu do usuário: Adriana Admin" }),
    ).toBeInTheDocument();
  });

  it("durante o carregamento continua com nome descritivo", () => {
    mockUser(null);
    render(<UserMenu />);

    expect(screen.getByRole("button", { name: "Menu do usuário" })).toBeInTheDocument();
  });
});
