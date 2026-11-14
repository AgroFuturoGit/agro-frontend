import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ComparisonSummary } from "./production/comparison-summary";
import { GoalGauge } from "./goal-gauge";

function valueArc(container: HTMLElement) {
  return container.querySelector('[data-slot="goal-gauge-value"]');
}

describe("GoalGauge", () => {
  afterEach(cleanup);

  it("expõe role=img com o nome '…% da meta alcançada'", () => {
    const { container } = render(
      <GoalGauge percentage={78.33} remainingLabel="Faltam 6,5 t para bater a meta" />,
    );

    expect(screen.getByRole("img", { name: "78,33% da meta alcançada" })).toBeInTheDocument();
    expect(screen.getByText("Faltam 6,5 t para bater a meta")).toBeInTheDocument();
    expect(valueArc(container)).toHaveAttribute("stroke-dasharray", "78.33 100");
    // SVG decorativo: a informação já está no nome do role=img.
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("arco respeita prefers-reduced-motion", () => {
    const { container } = render(<GoalGauge percentage={50} />);

    expect(valueArc(container)).toHaveClass("motion-reduce:transition-none");
  });

  it("0%: só o trilho, sem arco de valor", () => {
    const { container } = render(<GoalGauge percentage={0} />);

    expect(screen.getByRole("img", { name: "0% da meta alcançada" })).toBeInTheDocument();
    expect(valueArc(container)).toBeNull();
  });

  it("≥100%: arco cheio e 'Meta de colheita atingida' com ícone, sem emoji", () => {
    const { container } = render(<GoalGauge percentage={120} reached />);

    expect(screen.getByRole("img", { name: "120% da meta alcançada" })).toBeInTheDocument();
    expect(valueArc(container)).toHaveAttribute("stroke-dasharray", "100 100");
    const reached = screen.getByText("Meta de colheita atingida");
    expect(reached.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(container.textContent).not.toMatch(/🎉/u);
  });

  it("null (sem meta): mensagem curta e nenhum role=img", () => {
    render(<GoalGauge percentage={null} />);

    expect(screen.getByText("Sem meta definida")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("loading: skeletons e nenhum valor", () => {
    const { container } = render(<GoalGauge percentage={50} loading />);

    expect(screen.queryByRole("img")).toBeNull();
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBe(3);
  });
});

describe("ComparisonSummary — GoalGauge + 3 StatCards", () => {
  afterEach(cleanup);

  it("abaixo da meta: gauge com 'Faltam …' e Previsto/Realizado/Diferença", () => {
    const { container } = render(
      <ComparisonSummary
        unit="t"
        comparison={{
          productionPlanId: "p1",
          expectedYield: 43.98,
          totalActualYield: 28.23,
          difference: -15.75,
          percentageRealized: 64.19,
        }}
      />,
    );

    expect(screen.getByRole("img", { name: /da meta alcançada/ })).toBeInTheDocument();
    expect(screen.getByText("Faltam 15,75 t para bater a meta")).toBeInTheDocument();
    expect(screen.getByText("43,98 t")).toBeInTheDocument();
    expect(screen.getByText("28,23 t")).toBeInTheDocument();
    expect(screen.getByText("-15,75 t")).toBeInTheDocument();
    expect(container.querySelectorAll("[data-slot=card]").length).toBe(4);
  });

  it("meta atingida: texto com ícone e diferença com sinal +", () => {
    render(
      <ComparisonSummary
        comparison={{
          productionPlanId: "p1",
          expectedYield: 100,
          totalActualYield: 110,
          difference: 10,
          percentageRealized: 110,
        }}
      />,
    );

    expect(screen.getByText("Meta de colheita atingida")).toBeInTheDocument();
    expect(screen.getByText("+10 kg")).toBeInTheDocument();
  });

  it("plano sem previsto mostra 'Sem meta definida', e não '0% / meta atingida'", () => {
    render(
      <ComparisonSummary
        comparison={{
          productionPlanId: "p1",
          expectedYield: 0,
          totalActualYield: 0,
          difference: 0,
          percentageRealized: 0,
        }}
      />,
    );

    expect(screen.getByText("Sem meta definida")).toBeInTheDocument();
    expect(screen.queryByText("Meta de colheita atingida")).toBeNull();
  });
});
