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

describe("InlineAlert — actions (UX-L5-08)", () => {
  afterEach(cleanup);

  it("renderiza vários botões na ordem, com o mesmo formato do action", async () => {
    const clear = vi.fn();
    const retry = vi.fn();
    render(
      <InlineAlert
        actions={[
          { label: "Limpar filtros", onClick: clear },
          { label: "Tentar novamente", onClick: retry },
        ]}
      >
        Falhou
      </InlineAlert>,
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(["Limpar filtros", "Tentar novamente"]);
    buttons.forEach((b) => expect(b.getAttribute("data-slot")).toBe("button"));
    await userEvent.click(buttons[1]);
    expect(retry).toHaveBeenCalledTimes(1);
    expect(clear).not.toHaveBeenCalled();
  });
});

describe("InlineAlert — action e actions juntos", () => {
  afterEach(cleanup);

  it("action primeiro; disabled vale dentro de actions; rótulos repetidos não colidem", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <InlineAlert
        action={{ label: "A", onClick: vi.fn() }}
        actions={[
          { label: "B", onClick: vi.fn(), disabled: true },
          { label: "A", onClick: vi.fn() },
        ]}
      >
        Falhou
      </InlineAlert>,
    );
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["A", "B", "A"]);
    expect(screen.getByRole("button", { name: "B" })).toBeDisabled();
    expect(errors.mock.calls.some((c) => String(c[0]).includes("same key"))).toBe(false);
    errors.mockRestore();
  });
});
