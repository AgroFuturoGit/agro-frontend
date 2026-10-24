import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { createElement } from "react";

import {
  escapeHtml,
  readChartColors,
  useEchart,
} from "@/components/admin/dashboard/chart-utils";

const chart = vi.hoisted(() => ({
  setOption: vi.fn(),
  resize: vi.fn(),
  dispose: vi.fn(),
}));
const echarts = vi.hoisted(() => ({ init: vi.fn(), use: vi.fn() }));

vi.mock("echarts/core", () => echarts);

beforeEach(() => {
  echarts.init.mockReset().mockReturnValue(chart);
  chart.setOption.mockReset();
  chart.dispose.mockReset();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.documentElement.className = "";
  document.documentElement.style.cssText = "";
});

function Probe({ render: build }: { render: (c: ReturnType<typeof readChartColors>) => Record<string, unknown> }) {
  const ref = useEchart(true, build, []);
  return createElement("div", { ref });
}

describe("chart-utils (UNIT-002)", () => {
  it("lê os tokens de cor das CSS vars", () => {
    document.documentElement.style.setProperty("--chart-1", "red");
    document.documentElement.style.setProperty("--muted-foreground", "blue");
    const colors = readChartColors(document.documentElement);
    expect(colors.realized).toBe("red");
    expect(colors.palette[0]).toBe("red");
    expect(colors.text).toBe("blue");
  });

  it("escapa HTML", () => {
    expect(escapeHtml(`<b a="1">&`)).toBe("&lt;b a=&quot;1&quot;&gt;&amp;");
  });

  it("reaplica as cores quando o tema muda no <html>", async () => {
    document.documentElement.style.setProperty("--muted-foreground", "red");
    const build = vi.fn((c: { text: string }) => ({ text: c.text }));
    render(createElement(Probe, { render: build }));
    expect(chart.setOption).toHaveBeenCalledTimes(1);
    expect(chart.setOption.mock.calls[0][0]).toEqual({ text: "red" });

    await act(async () => {
      document.documentElement.style.setProperty("--muted-foreground", "green");
      document.documentElement.classList.add("dark");
      await Promise.resolve();
    });

    expect(chart.setOption.mock.calls.length).toBeGreaterThan(1);
    expect(chart.setOption.mock.calls.at(-1)?.[0]).toEqual({ text: "green" });
  });
});
