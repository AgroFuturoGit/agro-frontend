import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProducerFormDialog } from "@/components/admin/producers/producer-form-dialog";
import { updateProducer, type Producer } from "@/lib/producers";

vi.mock("@/lib/producers", async () => {
  const actual = await vi.importActual<typeof import("@/lib/producers")>(
    "@/lib/producers",
  );
  return { ...actual, updateProducer: vi.fn() };
});

const PRODUCER: Producer = {
  id: "producer-1",
  aliasName: "Zé do Milho",
  isCompliant: false,
  user: {
    id: "user-1",
    fullName: "José da Silva",
    email: "jose@agro.com",
    cpf: "12345678901",
  },
  community: {
    id: "community-1",
    name: "Comunidade Alfa",
    organization: {
      id: "org-1",
      name: "Cooperativa Alfa",
      taxId: "11222333000181",
      type: "COOP",
    },
  },
};

describe("ProducerFormDialog", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renderiza como barra lateral direita e salva as alterações", async () => {
    vi.mocked(updateProducer).mockResolvedValue(PRODUCER);
    const onSaved = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <ProducerFormDialog
        producer={PRODUCER}
        open
        onOpenChange={onOpenChange}
        onSaved={onSaved}
      />,
    );

    const dialog = await screen.findByRole("dialog");
    const sheet = dialog;
    expect(sheet).toHaveAttribute("data-slot", "sheet-content");
    expect(sheet).toHaveAttribute("data-side", "right");
    expect(sheet).toHaveClass("sm:max-w-md");

    fireEvent.change(screen.getByLabelText("Nome/apelido"), {
      target: { value: "Seu Zé" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => {
      expect(updateProducer).toHaveBeenCalledWith("producer-1", {
        aliasName: "Seu Zé",
        isCompliant: true,
      });
      expect(onSaved).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
