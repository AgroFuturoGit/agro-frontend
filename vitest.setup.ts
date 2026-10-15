// Injeta os custom matchers do jest-dom (toBeInTheDocument, toBeVisible,
// toBeDisabled, ...) no `expect` do Vitest, para toda a suíte.
import "@testing-library/jest-dom/vitest";

// O gráfico (ECharts) observa o tamanho do contêiner via ResizeObserver, ausente no jsdom.
if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserverPolyfill {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver =
    ResizeObserverPolyfill as unknown as typeof ResizeObserver;
}

// O jsdom não implementa canvas (getContext loga "Not implemented"): devolve
// null em silêncio; o código que depende de canvas trata a ausência.
if (typeof HTMLCanvasElement !== "undefined") {
  HTMLCanvasElement.prototype.getContext = (() =>
    null) as unknown as HTMLCanvasElement["getContext"];
}
