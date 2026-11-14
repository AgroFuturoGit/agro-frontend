import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Contratos de tokens decididos na revisão dos lotes 1A+1B (não dá para
// medir CSS computado no jsdom; o teste lê o :root do globals.css).
const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
const root = css.slice(css.indexOf(":root {"), css.indexOf(".dark {"));

function token(name: string) {
  const match = root.match(new RegExp(`\\s${name}:\\s*([^;]+);`));
  return match?.[1].trim();
}

function hue(value: string | undefined) {
  const match = value?.match(/oklch\(\s*[\d.]+\s+[\d.]+\s+([\d.]+)\s*\)/);
  return match ? Number(match[1]) : NaN;
}

describe("globals.css — tokens pós-revisão", () => {
  it("A11Y-8: --input escurecido (≥ 3:1) e --border mantido do Figma", () => {
    expect(token("--input")).toBe("oklch(0.65 0.02 262)");
    expect(token("--border")).toBe("oklch(0.928 0.006 264.5)");
  });

  it("UX-2: nenhuma série de gráfico usa o matiz de warning ou destructive", () => {
    const reserved = [hue(token("--warning")), hue(token("--destructive"))];
    for (const chart of ["--chart-2", "--chart-3", "--chart-4", "--chart-5"]) {
      const h = hue(token(chart));
      for (const r of reserved) {
        expect(Math.abs(h - r), `${chart} (${h}) perto de ${r}`).toBeGreaterThan(25);
      }
    }
    expect(token("--chart-1")).toBe(token("--primary"));
  });

  it("A11Y-5: número de KPI/gauge em 24px", () => {
    expect(css).toMatch(/--text-kpi:\s*1\.5rem;/);
    expect(css).toMatch(/--text-gauge:\s*1\.5rem;/);
  });
});
