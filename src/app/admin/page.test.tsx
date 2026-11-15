import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AdminDashboardPage from "./page";

vi.mock("@/components/admin/dashboard/production-dashboard", () => ({
  ProductionDashboard: () => <div data-testid="production-dashboard" />,
}));

describe("/admin — Visão geral", () => {
  afterEach(cleanup);

  it("PageHeader 'Visão geral' (h2) com a descrição e o painel por papel", () => {
    render(<AdminDashboardPage />);
    expect(screen.getByRole("heading", { level: 2, name: "Visão geral" })).toBeTruthy();
    expect(screen.getByText(/O realizado considera somente apontamentos validados/)).toBeTruthy();
    expect(screen.getByTestId("production-dashboard")).toBeTruthy();
  });
});
