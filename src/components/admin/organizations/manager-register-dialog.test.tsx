import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ManagerRegisterDialog } from "@/components/admin/organizations/manager-register-dialog";
import { registerManager } from "@/lib/organizations";
import type { Manager } from "@/lib/managers";

// Nenhum acesso de rede real — o cliente de API do domínio é mockado
// por completo.
vi.mock("@/lib/organizations", () => ({
  registerManager: vi.fn(),
  parseManagerRegisterFieldErrors: vi.fn(() => ({})),
}));

const REGISTERED_MANAGER: Manager = {
  id: "manager-1",
  user: {
    id: "user-1",
    fullName: "João Silva",
    email: "joao@agro.com",
    cpf: "12345678901",
    role: "MANAGER",
    dateOfBirth: "1990-05-20",
  },
  organization: {
    id: "org-1",
    name: "Cooperativa Alfa",
    taxId: "11222333000181",
    type: "COOP",
  },
};

function renderDialog() {
  return render(
    <ManagerRegisterDialog
      organizationId="org-1"
      organizationName="Cooperativa Alfa"
      open
      onOpenChange={() => {}}
    />,
  );
}

function fillValidForm() {
  fireEvent.change(screen.getByLabelText("Nome completo"), {
    target: { value: "João Silva" },
  });
  fireEvent.change(screen.getByLabelText("E-mail"), {
    target: { value: "joao@agro.com" },
  });
  fireEvent.change(screen.getByLabelText("CPF"), {
    target: { value: "12345678901" },
  });
  fireEvent.change(screen.getByLabelText("Data de nascimento"), {
    target: { value: "1990-05-20" },
  });
}

// Disparamos o evento "submit" diretamente no <form> (via document, pois
// o diálogo é portalizado fora do container de render) para contornar a
// validação nativa HTML5 dos campos `required`/`minLength` e exercitar a
// validação client-side do componente.
function submitForm() {
  const form = document.querySelector("form");
  expect(form).toBeTruthy();
  fireEvent.submit(form as HTMLFormElement);
}

describe("ManagerRegisterDialog — validação mínima do cadastro de Manager (spec.md §5)", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("senha com menos de 8 caracteres mostra erro e não chama registerManager", async () => {
    renderDialog();

    await screen.findByLabelText("Nome completo");
    fillValidForm();
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "1234567" },
    });

    submitForm();

    expect(
      await screen.findByText("A senha deve ter no mínimo 8 caracteres"),
    ).toBeTruthy();
    expect(registerManager).not.toHaveBeenCalled();
  });

  it("submit válido chama registerManager(organizationId, payload) com os campos esperados", async () => {
    vi.mocked(registerManager).mockResolvedValue(REGISTERED_MANAGER);

    renderDialog();

    await screen.findByLabelText("Nome completo");
    fillValidForm();
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "supersecreta" },
    });

    submitForm();

    await waitFor(() =>
      expect(registerManager).toHaveBeenCalledWith("org-1", {
        fullName: "João Silva",
        email: "joao@agro.com",
        password: "supersecreta",
        cpf: "123.456.789-01",
        dateOfBirth: "1990-05-20",
      }),
    );
  });
});
