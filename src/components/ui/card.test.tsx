import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Card } from "./card";

describe("Card — superfície unificada", () => {
  afterEach(cleanup);

  it("mantém data-slot=card e usa borda + bg-card, sem ring", () => {
    render(<Card data-testid="card">conteúdo</Card>);

    const card = screen.getByTestId("card");
    expect(card).toHaveAttribute("data-slot", "card");
    expect(card).toHaveAttribute("data-variant", "default");
    expect(card).toHaveClass("rounded-xl", "border", "bg-card");
    expect(card.className).not.toMatch(/\bring-1\b/);
  });

  it.each([
    ["highlight", "bg-secondary"],
    ["dashed", "border-dashed"],
  ] as const)("variante %s aplica %s", (variant, cls) => {
    render(
      <Card data-testid="card" variant={variant}>
        conteúdo
      </Card>,
    );

    const card = screen.getByTestId("card");
    expect(card).toHaveClass(cls);
    expect(card).toHaveAttribute("data-variant", variant);
  });

  it("className do consumidor sobrescreve a superfície (via cn)", () => {
    render(
      <Card data-testid="card" className="bg-transparent">
        conteúdo
      </Card>,
    );

    const card = screen.getByTestId("card");
    expect(card).toHaveClass("bg-transparent");
    expect(card).not.toHaveClass("bg-card");
  });
});
