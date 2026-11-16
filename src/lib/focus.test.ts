import { afterEach, describe, expect, it, vi } from "vitest";

import { moveFocusTo, withFocusMove } from "./focus";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("moveFocusTo", () => {
  it("foca um controle nativo pelo id sem mexer no tabindex", () => {
    document.body.innerHTML = '<button id="alvo">Safra</button>';
    expect(moveFocusTo("alvo")).toBe(true);
    const el = document.getElementById("alvo")!;
    expect(document.activeElement).toBe(el);
    expect(el.hasAttribute("tabindex")).toBe(false);
  });

  it("heading ou contêiner ganham tabindex=-1 e recebem o foco", () => {
    document.body.innerHTML = '<h2 id="titulo">Relatórios</h2>';
    const el = document.getElementById("titulo")!;
    expect(moveFocusTo(el)).toBe(true);
    expect(el.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(el);
  });

  it("mantém um tabindex já definido", () => {
    document.body.innerHTML = '<div id="regiao" tabindex="0">x</div>';
    moveFocusTo("regiao");
    expect(document.getElementById("regiao")!.getAttribute("tabindex")).toBe("0");
  });

  it("alvo ausente ou desconectado não faz nada", () => {
    expect(moveFocusTo("nao-existe")).toBe(false);
    expect(moveFocusTo(null)).toBe(false);
    expect(moveFocusTo(document.createElement("button"))).toBe(false);
    expect(document.activeElement).toBe(document.body);
  });
});

describe("withFocusMove", () => {
  it("move o foco ANTES da ação, então o foco sobrevive ao botão que desmonta", () => {
    document.body.innerHTML = '<select id="alvo"></select><button id="cta">Tentar</button>';
    const cta = document.getElementById("cta")!;
    cta.focus();
    const action = vi.fn(() => cta.remove());
    withFocusMove("alvo", action)();
    expect(action).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(document.getElementById("alvo"));
    expect(document.activeElement).not.toBe(document.body);
  });

  it("aceita uma função que devolve o alvo e repassa os argumentos", () => {
    document.body.innerHTML = '<p id="p">t</p>';
    const action = vi.fn();
    withFocusMove(() => document.getElementById("p"), action)("a", 1);
    expect(action).toHaveBeenCalledWith("a", 1);
    expect(document.activeElement?.id).toBe("p");
  });
});
