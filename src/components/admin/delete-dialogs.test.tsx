import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DeleteCropDialog } from "@/components/admin/crops/delete-crop-dialog";
import { DeleteHarvestDialog } from "@/components/admin/harvests/delete-harvest-dialog";
import { DeleteProducerDialog } from "@/components/admin/producers/delete-producer-dialog";
import { DeleteExecutionDialog } from "@/components/admin/production/delete-execution-dialog";
import { DeletePlanDialog } from "@/components/admin/production/delete-plan-dialog";
import { DeleteUserDialog } from "@/components/admin/users/delete-user-dialog";
import { ApiError } from "@/lib/api";
import { deleteCrop, type Crop } from "@/lib/crops";
import { deleteHarvest, type Harvest } from "@/lib/harvests";
import { deleteProducer, type Producer } from "@/lib/producers";
import {
  deleteProductionExecution,
  deleteProductionPlan,
  type ProductionExecution,
  type ProductionPlan,
} from "@/lib/production";
import { deleteUser, type User } from "@/lib/users";

vi.mock("@/lib/users", async () => ({
  ...(await vi.importActual<object>("@/lib/users")),
  deleteUser: vi.fn(),
}));
vi.mock("@/lib/crops", async () => ({
  ...(await vi.importActual<object>("@/lib/crops")),
  deleteCrop: vi.fn(),
}));
vi.mock("@/lib/harvests", async () => ({
  ...(await vi.importActual<object>("@/lib/harvests")),
  deleteHarvest: vi.fn(),
}));
vi.mock("@/lib/producers", async () => ({
  ...(await vi.importActual<object>("@/lib/producers")),
  deleteProducer: vi.fn(),
}));
vi.mock("@/lib/production", async () => ({
  ...(await vi.importActual<object>("@/lib/production")),
  deleteProductionPlan: vi.fn(),
  deleteProductionExecution: vi.fn(),
}));

const USER = { id: "u1", fullName: "Ana" } as User;
const CROP = { id: "c1", name: "Milho", variety: "BRS" } as Crop;
const HARVEST = { id: "h1", label: "Safra 1" } as Harvest;
const PRODUCER = { id: "p1", user: { fullName: "José" } } as unknown as Producer;
const PLAN = { id: "pl1", crop: { name: "Milho", variety: "BRS" } } as ProductionPlan;
const EXECUTION = {
  id: "e1",
  quantity: 3,
  harvestedAt: "2026-05-10",
} as ProductionExecution;

type Case = {
  name: string;
  del: ReturnType<typeof vi.fn>;
  render: (open: boolean, onDeleted: () => void) => ReactElement;
};

const CASES: Case[] = [
  {
    name: "usuário",
    del: vi.mocked(deleteUser),
    render: (open, onDeleted) => (
      <DeleteUserDialog user={USER} open={open} onOpenChange={vi.fn()} onDeleted={onDeleted} />
    ),
  },
  {
    name: "safra",
    del: vi.mocked(deleteHarvest),
    render: (open, onDeleted) => (
      <DeleteHarvestDialog harvest={HARVEST} open={open} onOpenChange={vi.fn()} onDeleted={onDeleted} />
    ),
  },
  {
    name: "cultura",
    del: vi.mocked(deleteCrop),
    render: (open, onDeleted) => (
      <DeleteCropDialog crop={CROP} open={open} onOpenChange={vi.fn()} onDeleted={onDeleted} />
    ),
  },
  {
    name: "produtor",
    del: vi.mocked(deleteProducer),
    render: (open, onDeleted) => (
      <DeleteProducerDialog producer={PRODUCER} open={open} onOpenChange={vi.fn()} onDeleted={onDeleted} />
    ),
  },
  {
    name: "plano",
    del: vi.mocked(deleteProductionPlan),
    render: (open, onDeleted) => (
      <DeletePlanDialog plan={PLAN} open={open} onOpenChange={vi.fn()} onDeleted={onDeleted} />
    ),
  },
  {
    name: "apontamento",
    del: vi.mocked(deleteProductionExecution),
    render: (open, onDeleted) => (
      <DeleteExecutionDialog execution={EXECUTION} open={open} onOpenChange={vi.fn()} onDeleted={onDeleted} />
    ),
  },
];

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe.each(CASES)("diálogo de exclusão de $name (UNIT-007)", (c) => {
  it("o erro de uma abertura não aparece na próxima", async () => {
    c.del.mockRejectedValue(new ApiError(500, "Falhou ao excluir", null));
    const onDeleted = vi.fn();
    const { rerender } = render(c.render(true, onDeleted));

    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    expect(await screen.findByText("Falhou ao excluir")).toBeTruthy();

    rerender(c.render(false, onDeleted));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    rerender(c.render(true, onDeleted));

    await screen.findByRole("alertdialog");
    expect(screen.queryByText("Falhou ao excluir")).toBeNull();
    expect((screen.getByRole("button", { name: "Excluir" }) as HTMLButtonElement).disabled).toBe(false);
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("depois de um 'não encontrado' a lista é recarregada", async () => {
    c.del.mockRejectedValue(new ApiError(404, "Não encontrado", null));
    const onDeleted = vi.fn();
    render(c.render(true, onDeleted));

    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    expect(await screen.findByText("Não encontrado")).toBeTruthy();
    expect(onDeleted).toHaveBeenCalledTimes(1);
  });
});
