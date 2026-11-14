import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Progress } from "./progress";

describe("Progress", () => {
  afterEach(cleanup);

  it("expõe role=progressbar com valor e nome acessível", () => {
    render(<Progress value={42} aria-label="Progresso de Milho" />);

    const bar = screen.getByRole("progressbar", { name: "Progresso de Milho" });
    expect(bar).toHaveAttribute("aria-valuenow", "42");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });

  it("repassa indicatorProps ao indicador (data-testid=progress-fill) e aplica a largura", () => {
    render(
      <Progress
        value={30}
        aria-label="Progresso"
        indicatorProps={{ "data-testid": "progress-fill" }}
      />,
    );

    const fill = screen.getByTestId("progress-fill");
    expect(fill).toHaveAttribute("data-slot", "progress-indicator");
    expect(fill.style.width).toBe("30%");
  });

  it.each([
    ["primary", "bg-primary"],
    ["success", "bg-success"],
    ["warning", "bg-warning"],
    ["destructive", "bg-destructive"],
    ["muted", "bg-muted-foreground"],
  ] as const)("variante %s pinta o indicador com %s", (variant, cls) => {
    render(
      <Progress
        value={50}
        variant={variant}
        aria-label="Progresso"
        indicatorProps={{ "data-testid": "progress-fill" }}
      />,
    );

    const fill = screen.getByTestId("progress-fill");
    expect(fill).toHaveClass(cls);
    expect(fill).toHaveAttribute("data-variant", variant);
  });
});
