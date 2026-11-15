import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DashboardToolbar, FilterSelect } from "./dashboard-toolbar";

describe("DashboardToolbar / FilterSelect", () => {
  afterEach(cleanup);

  it("barra é um Card com o recorte e os filtros; o rótulo nomeia o combobox", () => {
    render(
      <DashboardToolbar heading={<p>Safra: Safra 2026</p>}>
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
});
