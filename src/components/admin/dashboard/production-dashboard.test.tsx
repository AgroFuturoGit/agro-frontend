import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

import { ProductionDashboard } from "@/components/admin/dashboard/production-dashboard";
import { readUserFromStorage, type AuthUser, type Role } from "@/lib/auth";

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return { ...actual, readUserFromStorage: vi.fn() };
});

vi.mock("@/components/admin/dashboard/farmer-dashboard", () => ({
  FarmerDashboard: () => <div data-testid="farmer-dashboard" />,
}));

vi.mock("@/components/admin/dashboard/technician-dashboard", () => ({
  TechnicianDashboard: () => <div data-testid="technician-dashboard" />,
}));

vi.mock("@/components/admin/dashboard/management-dashboard", () => ({
  ManagementDashboard: ({ role }: { role: string }) => (
    <div data-testid="management-dashboard" data-role={role} />
  ),
}));

function loginAs(role: Role | null) {
  vi.mocked(readUserFromStorage).mockReturnValue(
    role
      ? ({ id: "u", fullName: "Fulano", email: "f@a.com", cpf: "1", role, dateOfBirth: null } as AuthUser)
      : null,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ProductionDashboard — roteamento por perfil (UNIT-002)", () => {
  beforeEach(() => loginAs("ADMIN"));

  it("FARMER: vê o dashboard da 6.1", async () => {
    loginAs("FARMER");
    render(<ProductionDashboard />);
    await waitFor(() => expect(screen.getByTestId("farmer-dashboard")).toBeTruthy());
    expect(screen.queryByTestId("management-dashboard")).toBeNull();
    expect(screen.queryByTestId("technician-dashboard")).toBeNull();
  });

  it("TECHNICIAN: vê o dashboard da 6.2", async () => {
    loginAs("TECHNICIAN");
    render(<ProductionDashboard />);
    await waitFor(() => expect(screen.getByTestId("technician-dashboard")).toBeTruthy());
    expect(screen.queryByTestId("management-dashboard")).toBeNull();
    expect(screen.queryByTestId("farmer-dashboard")).toBeNull();
  });

  it.each(["MANAGER", "ADMIN"] as const)("%s: vê o dashboard da 6.3 no escopo do perfil", async (role) => {
    loginAs(role);
    render(<ProductionDashboard />);
    const panel = await screen.findByTestId("management-dashboard");
    expect(panel.getAttribute("data-role")).toBe(role);
    expect(screen.queryByTestId("farmer-dashboard")).toBeNull();
    expect(screen.queryByTestId("technician-dashboard")).toBeNull();
  });

  it("role desconhecida: nada renderiza (falha fechado)", async () => {
    loginAs(null);
    const { container } = render(<ProductionDashboard />);
    await waitFor(() => expect(readUserFromStorage).toHaveBeenCalled());
    expect(container.innerHTML).toBe("");
  });
});
