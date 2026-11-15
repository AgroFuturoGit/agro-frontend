import { afterEach, describe, expect, it, vi } from "vitest";

import {
  chartTextStyle,
  formatAxisNumber,
  readChartFontFamily,
  readToken,
  toRgb,
} from "@/components/admin/dashboard/chart-tokens";
import * as utils from "@/components/admin/dashboard/chart-utils";

vi.mock("echarts/core", () => ({ init: vi.fn(), use: vi.fn() }));

function stubCanvas(rgba: [number, number, number, number]) {
  const ctx = {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: "",
    getImageData: () => ({ data: rgba }),
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    ctx as unknown as ReturnType<HTMLCanvasElement["getContext"]>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.style.fontFamily = "";
  document.documentElement.style.cssText = "";
});

describe("chart-tokens", () => {
  it("toRgb opaco devolve rgb()", () => {
    stubCanvas([10, 20, 30, 255]);
    expect(toRgb("oklch(0.5 0.1 140)")).toBe("rgb(10, 20, 30)");
  });

  it("toRgb com alpha devolve rgba() multiplicando a opacidade", () => {
    stubCanvas([10, 20, 30, 255]);
    expect(toRgb("red", 0.35)).toBe("rgba(10, 20, 30, 0.35)");
  });

  it("toRgb preserva o alfa da própria cor", () => {
    stubCanvas([10, 20, 30, 128]);
    expect(toRgb("rgba(10, 20, 30, 0.5)")).toBe("rgba(10, 20, 30, 0.5)");
  });

  it("toRgb sem contexto 2d devolve o valor original", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    expect(toRgb("red")).toBe("red");
  });

  it("readToken lê e apara a CSS var", () => {
    document.documentElement.style.setProperty("--chart-1", "  red ");
    expect(readToken(document.documentElement, "--chart-1")).toBe("red");
  });

  it("readChartFontFamily lê a fonte do body", () => {
    document.body.style.fontFamily = "Inter, sans-serif";
    expect(readChartFontFamily()).toContain("Inter");
  });

  it("chart-utils reexporta os helpers", () => {
    expect(utils.toRgb).toBe(toRgb);
    expect(utils.readToken).toBe(readToken);
    expect(utils.readChartFontFamily).toBe(readChartFontFamily);
  });
});

describe("formatAxisNumber", () => {
  it("usa o separador pt-BR (30.000; 2,5)", () => {
    expect(formatAxisNumber(30000)).toBe("30.000");
    expect(formatAxisNumber(2.5)).toBe("2,5");
    expect(formatAxisNumber(0)).toBe("0");
  });
});

describe("formatAxisNumber — bordas", () => {
  it("negativo e arredondamento em 2 casas", () => {
    expect(formatAxisNumber(-1500)).toBe("-1.500");
    expect(formatAxisNumber(2.555)).toBe("2,56");
  });
});

describe("chartTextStyle", () => {
  it("só inclui fontFamily quando houver", () => {
    expect(chartTextStyle("red")).toEqual({ color: "red" });
    expect(chartTextStyle("red", "Roboto")).toEqual({ color: "red", fontFamily: "Roboto" });
  });
});
