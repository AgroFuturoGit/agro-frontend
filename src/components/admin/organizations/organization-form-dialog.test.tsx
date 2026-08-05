import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import { OrganizationFormDialog } from "@/components/admin/organizations/organization-form-dialog";
import { createOrganization, updateOrganization } from "@/lib/organizations";
import type { Organization } from "@/lib/organizations";

// Nenhum acesso de rede real — o cliente de API do domínio é mockado
// por completo.
vi.mock("@/lib/organizations", () => ({
  ORGANIZATION_TYPE_LABELS: { COOP: "Cooperativa", ASSOC: "Associação" },
  createOrganization: vi.fn(),
  updateOrganization: vi.fn(),
  parseOrganizationFieldErrors: vi.fn(() => ({})),
}));

const ORGANIZATION: Organization = {
  id: "org-1",
  name: "Cooperativa Alfa",
  taxId: "11222333000181",
  type: "COOP",
};

function renderDialog(
  mode: "create" | "edit",
  organization: Organization | null = null,
) {
  return render(
    <OrganizationFormDialog
      mode={mode}
      open
      onOpenChange={() => {}}
      onSaved={() => {}}
      organization={organization}
    />,
  );
}

describe("OrganizationFormDialog — imutabilidade de type/taxId em modo edição (spec.md §5, Task 01-01)", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("em modo edit, type e taxId são renderizados como texto (sem Select/Input interativo)", async () => {
    renderDialog("edit", ORGANIZATION);

    await screen.findByLabelText("Nome");

    // Não há combobox (Select) nem input associado a taxId/type.
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByLabelText("CNPJ")).toBeNull();
    expect(screen.queryByLabelText("Tipo")).toBeNull();

    // Os valores aparecem apenas como texto simples read-only.
    expect(screen.getByText("CNPJ")).toBeTruthy();
    expect(screen.getByText("11.222.333/0001-81")).toBeTruthy();
    expect(screen.getByText("Tipo")).toBeTruthy();
    expect(screen.getByText("Cooperativa")).toBeTruthy();
  });

  it("em modo create, type é um Select interativo e taxId é um Input editável", async () => {
    renderDialog("create");

    await screen.findByLabelText("Nome");

    const typeSelect = screen.getByRole("combobox");
    expect(screen.getByLabelText("Tipo")).toBe(typeSelect);

    const taxIdInput = screen.getByLabelText("CNPJ");
    expect(taxIdInput.tagName).toBe("INPUT");

    fireEvent.change(taxIdInput, { target: { value: "11222333000181" } });
    expect((taxIdInput as HTMLInputElement).value).toBe(
      "11.222.333/0001-81",
    );
  });

  it("submit com name/taxId vazios em modo create bloqueia o submit e mostra os erros", async () => {
    renderDialog("create");

    await screen.findByLabelText("Nome");

    // Disparamos o evento "submit" diretamente no <form> (via document,
    // pois o diálogo é portalizado fora do container de render) para
    // contornar a validação nativa HTML5 dos campos `required` e
    // exercitar a validação client-side do componente.
    const form = document.querySelector("form");
    expect(form).toBeTruthy();
    fireEvent.submit(form as HTMLFormElement);

    expect(
      await screen.findByText("Informe o nome da organização"),
    ).toBeTruthy();
    expect(screen.getByText("Informe o CNPJ")).toBeTruthy();
    expect(createOrganization).not.toHaveBeenCalled();
    expect(updateOrganization).not.toHaveBeenCalled();
  });
});

describe("OrganizationFormDialog — submit de sucesso (gaps QA #3)", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("em modo edit, submit válido chama updateOrganization com name novo e taxId/type originais preservados", async () => {
    vi.mocked(updateOrganization).mockResolvedValue({
      ...ORGANIZATION,
      name: "Nome Editado",
    });
    renderDialog("edit", ORGANIZATION);

    const nameInput = await screen.findByLabelText("Nome");
    fireEvent.change(nameInput, { target: { value: "Nome Editado" } });

    const form = document.querySelector("form");
    fireEvent.submit(form as HTMLFormElement);

    await waitFor(() =>
      expect(updateOrganization).toHaveBeenCalledWith("org-1", {
        name: "Nome Editado",
        taxId: ORGANIZATION.taxId,
        type: ORGANIZATION.type,
      }),
    );
    expect(createOrganization).not.toHaveBeenCalled();
  });

  it("em modo create, submit válido chama createOrganization com o payload preenchido", async () => {
    vi.mocked(createOrganization).mockResolvedValue(ORGANIZATION);
    renderDialog("create");

    fireEvent.change(await screen.findByLabelText("Nome"), {
      target: { value: "Coop Nova" },
    });
    fireEvent.change(screen.getByLabelText("CNPJ"), {
      target: { value: "12345678000199" },
    });

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(await screen.findByRole("option", { name: "Cooperativa" }));

    const form = document.querySelector("form");
    fireEvent.submit(form as HTMLFormElement);

    await waitFor(() =>
      expect(createOrganization).toHaveBeenCalledWith({
        name: "Coop Nova",
        taxId: "12.345.678/0001-99",
        type: "COOP",
      }),
    );
    expect(updateOrganization).not.toHaveBeenCalled();
  });
});
