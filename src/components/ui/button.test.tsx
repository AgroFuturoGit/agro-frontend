import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Button, buttonVariants } from "./button";

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

describe("Button — foco da variante default (A11Y-L5-2)", () => {
  afterEach(cleanup);

  it("anel opaco com offset (a borda --ring some no fundo primário)", () => {
    render(<Button>Salvar</Button>);
    const button = screen.getByRole("button", { name: "Salvar" });
    expect(button).toHaveClass(
      "focus-visible:ring-2",
      "focus-visible:ring-ring",
      "focus-visible:ring-offset-2",
      "focus-visible:ring-offset-background",
      "bg-primary",
      "hover:bg-primary-hover",
    );
    expect(button.className).not.toMatch(/ring-ring\/50|focus-visible:ring-3/);
  });

  it("buttonVariants já resolve o conflito (links com visual de botão)", () => {
    const classes = buttonVariants().split(" ");
    expect(classes).toContain("focus-visible:ring-offset-2");
    expect(classes).not.toContain("focus-visible:ring-ring/50");
  });

  it("outline mantém o foco da base (só o default mudou)", () => {
    render(<Button variant="outline">Filtrar</Button>);
    expect(screen.getByRole("button", { name: "Filtrar" })).toHaveClass(
      "focus-visible:ring-3",
      "focus-visible:ring-ring/50",
    );
  });
});
