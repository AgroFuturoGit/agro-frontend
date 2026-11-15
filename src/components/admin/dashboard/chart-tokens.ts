/**
 * Leitura de tokens de cor para os gráficos ECharts (canvas). Sem efeitos
 * colaterais de módulo: o gráfico do plano importa daqui sem registrar os
 * charts do dashboard. Reexportado por `chart-utils.ts`.
 */

/**
 * Converte um valor CSS de cor (inclusive oklch) em "rgb()/rgba()" que o
 * canvas do ECharts entende, pintando 1 pixel e lendo-o de volta. `alpha`
 * multiplica a opacidade da própria cor.
 */
export function toRgb(value: string, alpha = 1): string {
  try {
    const ctx = document.createElement("canvas").getContext("2d", {
      willReadFrequently: true,
    });
    if (!ctx) return value;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    const total = Math.round((a / 255) * alpha * 100) / 100;
    return total >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${total})`;
  } catch {
    return value;
  }
}

/** Valor bruto (já resolvido) de uma CSS var no escopo informado. */
export function readToken(scope: Element, name: string): string {
  return getComputedStyle(scope).getPropertyValue(name).trim();
}

/** Fonte do sistema (a do `<body>`) para eixos e legendas dos gráficos. */
export function readChartFontFamily(): string | undefined {
  if (typeof document === "undefined" || !document.body) return undefined;
  return getComputedStyle(document.body).fontFamily || undefined;
}

/**
 * Rótulo numérico dos eixos no formato pt-BR (30.000; 2,5). O ECharts usa
 * o separador en por padrão.
 */
export function formatAxisNumber(value: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/**
 * `textStyle` do ECharts com a cor e, quando houver, a fonte do sistema.
 * Ponto único da regra de fonte dos gráficos (raiz e tooltip).
 */
export function chartTextStyle(
  color: string,
  fontFamily?: string,
): { color: string; fontFamily?: string } {
  return fontFamily ? { color, fontFamily } : { color };
}
