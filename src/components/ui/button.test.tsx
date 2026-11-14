import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Button } from "./button";

describe("Button — variante destructive (UX-1/A11Y-4)", () => {
  afterEach(cleanup);

  it("é sólida: fundo destructive com texto destructive-foreground", () => {
    render(<Button variant="destructive">Excluir usuário</Button>);

    const button = screen.getByRole("button", { name: "Excluir usuário" });
    expect(button).toHaveClass(
      "bg-destructive",
      "text-destructive-foreground",
      "hover:bg-destructive-strong",
    );
    // Nada do tom translúcido antigo (texto vermelho sobre vermelho 10%: 4,12:1).
    expect(button.className).not.toMatch(/bg-destructive\/10|\btext-destructive\b(?!-)/);
  });

  it("foco visível com anel opaco e offset", () => {
    render(<Button variant="destructive">Excluir</Button>);

    expect(screen.getByRole("button", { name: "Excluir" })).toHaveClass(
      "focus-visible:ring-destructive",
      "focus-visible:ring-offset-2",
    );
  });
});
