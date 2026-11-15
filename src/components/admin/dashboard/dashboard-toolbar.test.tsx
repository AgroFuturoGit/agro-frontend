import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DashboardToolbar, FilterSelect } from "./dashboard-toolbar";

describe("DashboardToolbar / FilterSelect", () => {
  afterEach(cleanup);

  it("barra é um Card com o recorte e os filtros; o rótulo nomeia o combobox", () => {
    render(
      <DashboardToolbar title="Minha carteira" description="Safra: Safra 2026">
        <FilterSelect
          id="f-safra"
          label="Safra"
          value="a"
          onChange={() => {}}
          options={[
            { value: "a", label: "Safra vigente" },
            { value: "b", label: "Safra 2025" },
          ]}
        />
      </DashboardToolbar>,
    );

    const bar = screen.getByTestId("dashboard-toolbar");
    expect(bar.getAttribute("data-slot")).toBe("card");
    expect(bar.textContent).toContain("Safra: Safra 2026");
    expect(screen.getByText("Minha carteira").className).toContain("text-lg");
    expect(screen.getByText("Safra: Safra 2026").className).toContain("text-muted-foreground");
    const combo = screen.getByRole("combobox", { name: "Safra" });
    expect(combo.textContent).toContain("Safra vigente");
  });

  it("filtro desabilitado repassa o disabled ao gatilho", () => {
    render(
      <FilterSelect
        id="f-com"
        label="Comunidade"
        value="all"
        disabled
        onChange={() => {}}
        options={[{ value: "all", label: "Todas" }]}
      />,
    );
    expect(screen.getByRole("combobox", { name: "Comunidade" }).hasAttribute("disabled")).toBe(true);
  });

  it("primeira carga: skeleton só no que ainda não chegou", () => {
    const { container } = render(
      <DashboardToolbar title="Minha produção" loading>
        <span />
      </DashboardToolbar>,
    );
    expect(screen.getByText("Minha produção")).toBeTruthy();
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(1);
  });

  it("primeira carga sem título: skeleton do título e da safra", () => {
    const { container } = render(
      <DashboardToolbar loading>
        <span />
      </DashboardToolbar>,
    );
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(2);
  });
});
