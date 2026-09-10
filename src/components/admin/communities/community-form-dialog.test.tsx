import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { CommunityFormDialog } from "@/components/admin/communities/community-form-dialog";
import {
  createCommunity,
  parseCommunityFieldErrors,
  updateCommunity,
} from "@/lib/communities";
import type { Community } from "@/lib/communities";
import { listOrganizations } from "@/lib/organizations";
import type { Organization } from "@/lib/organizations";

// Nenhum acesso de rede real: os dois clientes de API usados pelo
// diálogo são mockados por completo.
vi.mock("@/lib/communities", () => ({
  createCommunity: vi.fn(),
  updateCommunity: vi.fn(),
  parseCommunityFieldErrors: vi.fn(() => ({})),
}));

vi.mock("@/lib/organizations", () => ({
  listOrganizations: vi.fn(),
}));

const ORGANIZATIONS: Organization[] = [
  { id: "org-1", name: "Cooperativa Alfa", taxId: "11111111000191", type: "COOP" },
  { id: "org-2", name: "Associação Beta", taxId: "22222222000192", type: "ASSOC" },
];

const COMMUNITY: Community = {
  id: "com-1",
  name: "Comunidade Existente",
  organization: ORGANIZATIONS[0],
};

type RenderOptions = {
  mode?: "create" | "edit";
  role: "ADMIN" | "MANAGER";
  organizationId?: string | null;
  community?: Community | null;
};

function renderDialog({
  mode = "create",
  role,
  organizationId = null,
  community = null,
}: RenderOptions) {
  vi.mocked(listOrganizations).mockResolvedValue(ORGANIZATIONS);

  return render(
    <CommunityFormDialog
      mode={mode}
      role={role}
      organizationId={organizationId}
      open
      onOpenChange={() => {}}
      onSaved={() => {}}
      community={community}
    />,
  );
}

describe("CommunityFormDialog — resolução de organização por role (spec.md §5, decisão D3)", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it.each(["create", "edit"] as const)(
    "MANAGER não vê nenhum seletor de organização em modo %s",
    async (mode) => {
      renderDialog({
        mode,
        role: "MANAGER",
        organizationId: "org-1",
        community: mode === "edit" ? COMMUNITY : null,
      });

      await screen.findByLabelText("Nome da comunidade");

      expect(screen.queryByRole("combobox")).toBeNull();
      expect(screen.queryByLabelText("Organização")).toBeNull();
      // MANAGER nunca dispara a listagem de organizações — não pode
      // sequer enxergar outras organizações (lesson backend-hierarchy-ownership).
      expect(listOrganizations).not.toHaveBeenCalled();
    },
  );

  it("ADMIN em modo create vê o seletor de organização", async () => {
    renderDialog({ role: "ADMIN" });

    const select = await screen.findByRole("combobox");
    expect(select).toBeTruthy();
    expect(screen.getByLabelText("Organização")).toBe(select);
    await waitFor(() => expect(listOrganizations).toHaveBeenCalledTimes(1));
  });

  it("ADMIN em modo edit não vê o seletor (organização não é editável)", async () => {
    renderDialog({ mode: "edit", role: "ADMIN", community: COMMUNITY });

    await screen.findByLabelText("Nome da comunidade");

    expect(screen.queryByRole("combobox")).toBeNull();
    expect(listOrganizations).not.toHaveBeenCalled();
  });

  it("submit com nome vazio mostra erro e não chama createCommunity", async () => {
    renderDialog({ role: "MANAGER", organizationId: "org-1" });

    fireEvent.click(await screen.findByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Informe o nome da comunidade")).toBeTruthy();
    expect(createCommunity).not.toHaveBeenCalled();
    expect(updateCommunity).not.toHaveBeenCalled();
  });

  it("submit com nome vazio em modo edit não chama updateCommunity", async () => {
    renderDialog({ mode: "edit", role: "MANAGER", community: COMMUNITY });

    const input = await screen.findByLabelText("Nome da comunidade");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(await screen.findByText("Informe o nome da comunidade")).toBeTruthy();
    expect(updateCommunity).not.toHaveBeenCalled();
    expect(createCommunity).not.toHaveBeenCalled();
  });
});

describe("CommunityFormDialog — submit de sucesso (gaps QA #4)", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("MANAGER com nome válido chama createCommunity(organizationId, { name }) e não vê erro", async () => {
    vi.mocked(createCommunity).mockResolvedValue(COMMUNITY);
    renderDialog({ role: "MANAGER", organizationId: "org-1" });

    fireEvent.change(await screen.findByLabelText("Nome da comunidade"), {
      target: { value: "Comunidade Nova" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(createCommunity).toHaveBeenCalledWith("org-1", {
        name: "Comunidade Nova",
      }),
    );
    expect(updateCommunity).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("edição com nome válido chama updateCommunity(id, { name })", async () => {
    vi.mocked(updateCommunity).mockResolvedValue({
      ...COMMUNITY,
      name: "Nome Editado",
    });
    renderDialog({ mode: "edit", role: "MANAGER", community: COMMUNITY });

    const input = await screen.findByLabelText("Nome da comunidade");
    fireEvent.change(input, { target: { value: "Nome Editado" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() =>
      expect(updateCommunity).toHaveBeenCalledWith("com-1", {
        name: "Nome Editado",
      }),
    );
    expect(createCommunity).not.toHaveBeenCalled();
  });
});

describe("CommunityFormDialog — erro de servidor com campo específico (gap #5 do QA)", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("erro do servidor com campo específico é exibido via parseCommunityFieldErrors", async () => {
    const { ApiError } = await import("@/lib/api");
    const errorPayload = {
      message: "name: já existe uma comunidade com esse nome",
    };
    vi.mocked(createCommunity).mockRejectedValue(
      new ApiError(422, "name: já existe uma comunidade com esse nome", errorPayload),
    );
    vi.mocked(parseCommunityFieldErrors).mockReturnValue({
      name: "já existe uma comunidade com esse nome",
    });

    renderDialog({ role: "MANAGER", organizationId: "org-1" });

    fireEvent.change(await screen.findByLabelText("Nome da comunidade"), {
      target: { value: "Duplicada" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(
      await screen.findByText("já existe uma comunidade com esse nome"),
    ).toBeTruthy();
    expect(parseCommunityFieldErrors).toHaveBeenCalledWith(errorPayload);
  });
});
