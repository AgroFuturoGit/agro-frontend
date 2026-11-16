/**
 * Foco de links de texto dentro de cards: anel opaco (`--ring`, 5,1:1) com
 * offset na cor do card, como no BackLink. Nunca `ring-ring/50` sozinho
 * (2,08:1, abaixo de 3:1).
 */
export const FOCUS_RING_LINK =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";

/**
 * Foco de alvos de script (`moveFocusTo`): contêiner de tabela, título de
 * página. Anel opaco só no teclado (`focus-visible`), com offset na cor do
 * fundo da página. Mesmo anel do `FOCUS_RING_LINK`.
 */
export const FOCUS_TARGET =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const NATIVE_FOCUSABLE =
  "a[href], button, input, select, textarea, summary, [contenteditable='true']";

/**
 * Move o foco para um alvo estável quando o botão acionado vai desmontar
 * (ex.: "Tentar novamente" ou o CTA de um estado vazio, que somem quando a
 * nova carga começa). Sem isso o foco cai no `<body>` (WCAG 2.4.3).
 *
 * Aceita o elemento ou o seu `id`. Heading, região ou contêiner que não são
 * focáveis ganham `tabindex="-1"` (focáveis por script, fora da ordem do
 * Tab). Chame ANTES da ação, enquanto o botão ainda está montado. Devolve
 * `true` se o foco ficou no alvo.
 */
export function moveFocusTo(target: HTMLElement | string | null | undefined): boolean {
  if (typeof document === "undefined" || !target) return false;
  const el = typeof target === "string" ? document.getElementById(target) : target;
  if (!el || !el.isConnected) return false;
  if (!el.matches(NATIVE_FOCUSABLE) && !el.hasAttribute("tabindex")) {
    el.setAttribute("tabindex", "-1");
  }
  el.focus();
  return document.activeElement === el;
}

/** Envolve um `onClick` para mover o foco para `target` antes de executá-lo. */
export function withFocusMove<A extends unknown[]>(
  target: HTMLElement | string | (() => HTMLElement | string | null | undefined),
  action: (...args: A) => void,
): (...args: A) => void {
  return (...args: A) => {
    moveFocusTo(typeof target === "function" ? target() : target);
    action(...args);
  };
}
