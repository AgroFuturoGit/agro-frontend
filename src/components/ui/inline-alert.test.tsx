import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InlineAlert } from "./inline-alert";

describe("InlineAlert", () => {
  afterEach(cleanup);

  it.each([
    ["destructive", "alert"],
    ["warning", "alert"],
    ["success", "status"],
    ["info", "status"],
  ] as const)("variante %s usa role=%s por padrão", (variant, role) => {
    render(<InlineAlert variant={variant}>Mensagem</InlineAlert>);

    expect(screen.getByRole(role)).toHaveTextContent("Mensagem");
  });

  it("é destructive + role=alert sem props", () => {
    render(<InlineAlert>Não foi possível salvar.</InlineAlert>);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("data-variant", "destructive");
    expect(alert).toHaveClass("bg-destructive-muted");
  });

  it("aceita override de role (warning com role=status)", () => {
    render(
      <InlineAlert variant="warning" role="status">
        Aviso
      </InlineAlert>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Aviso");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("o ícone é decorativo e pode ser removido", () => {
    const { container, rerender } = render(<InlineAlert>Erro</InlineAlert>);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");

    rerender(<InlineAlert icon={false}>Erro</InlineAlert>);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("renderiza a ação e chama onClick", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <InlineAlert action={{ label: "Tentar novamente", onClick }}>
        Não foi possível carregar os dados.
      </InlineAlert>,
    );

    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("desabilita a ação quando action.disabled", () => {
    render(
      <InlineAlert action={{ label: "Tentar novamente", onClick: () => {}, disabled: true }}>
        Erro
      </InlineAlert>,
    );

    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeDisabled();
  });
});
