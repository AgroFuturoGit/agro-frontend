import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api";
import type { ManagerApiResponse } from "@/lib/managers";
import {
  createOrganization,
  deleteOrganization,
  getOrganization,
  listOrganizations,
  mapOrganization,
  parseManagerRegisterFieldErrors,
  parseOrganizationFieldErrors,
  registerManager,
  updateOrganization,
  type ManagerRegisterPayload,
  type OrganizationApiResponse,
  type OrganizationPayload,
} from "@/lib/organizations";

// Nenhum teste pode tocar a rede: `apiRequest` é sempre mockado.
vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
}));

const apiRequestMock = vi.mocked(apiRequest);

const RAW_ORGANIZATION: OrganizationApiResponse = {
  id: "org-1",
  name: "Cooperativa Vale Verde",
  taxId: "12345678000199",
  type: "COOP",
};

const RAW_MANAGER: ManagerApiResponse = {
  id: "mgr-1",
  user: {
    id: "usr-1",
    fullName: "Maria Gestora",
    email: "maria@agro.com",
    cpf: "11122233344",
    role: "MANAGER",
    dateOfBirth: "1990-05-10",
  },
  organization: RAW_ORGANIZATION,
};

beforeEach(() => {
  apiRequestMock.mockReset();
});

describe("mapOrganization", () => {
  it("mapeia a response crua para o modelo de domínio", () => {
    expect(mapOrganization(RAW_ORGANIZATION)).toEqual({
      id: "org-1",
      name: "Cooperativa Vale Verde",
      taxId: "12345678000199",
      type: "COOP",
    });
  });

  it("preserva o id como string (nunca number)", () => {
    expect(typeof mapOrganization(RAW_ORGANIZATION).id).toBe("string");
  });
});

describe("listOrganizations", () => {
  it("chama apiRequest com /organizations e método GET", async () => {
    apiRequestMock.mockResolvedValue([RAW_ORGANIZATION]);

    await listOrganizations();

    expect(apiRequestMock).toHaveBeenCalledWith("/organizations", {
      method: "GET",
    });
  });

  it("retorna a lista mapeada", async () => {
    apiRequestMock.mockResolvedValue([RAW_ORGANIZATION]);

    await expect(listOrganizations()).resolves.toEqual([
      mapOrganization(RAW_ORGANIZATION),
    ]);
  });
});

describe("getOrganization", () => {
  it("chama apiRequest com GET /organizations/{id} e retorna mapeado", async () => {
    apiRequestMock.mockResolvedValue(RAW_ORGANIZATION);

    await expect(getOrganization("org-1")).resolves.toEqual(
      mapOrganization(RAW_ORGANIZATION),
    );
    expect(apiRequestMock).toHaveBeenCalledWith("/organizations/org-1", {
      method: "GET",
    });
  });
});

describe("createOrganization", () => {
  it("chama apiRequest com POST /organizations e o payload", async () => {
    apiRequestMock.mockResolvedValue(RAW_ORGANIZATION);

    const payload: OrganizationPayload = {
      name: "Nova Coop",
      taxId: "12345678000199",
      type: "COOP",
    };

    await createOrganization(payload);

    expect(apiRequestMock).toHaveBeenCalledWith("/organizations", {
      method: "POST",
      body: payload,
    });
  });

  it("retorna a organização mapeada", async () => {
    apiRequestMock.mockResolvedValue(RAW_ORGANIZATION);

    const payload: OrganizationPayload = {
      name: "Nova Coop",
      taxId: "12345678000199",
      type: "COOP",
    };

    await expect(createOrganization(payload)).resolves.toEqual(
      mapOrganization(RAW_ORGANIZATION),
    );
  });
});

describe("updateOrganization", () => {
  it("chama apiRequest com PUT /organizations/{id} e o payload", async () => {
    apiRequestMock.mockResolvedValue(RAW_ORGANIZATION);

    const payload: OrganizationPayload = {
      name: "Novo nome",
      taxId: "12345678000199",
      type: "COOP",
    };

    await updateOrganization("org-1", payload);

    expect(apiRequestMock).toHaveBeenCalledWith("/organizations/org-1", {
      method: "PUT",
      body: payload,
    });
  });
});

describe("deleteOrganization", () => {
  it("chama apiRequest com DELETE /organizations/{id}", async () => {
    apiRequestMock.mockResolvedValue(undefined);

    await deleteOrganization("org-1");

    expect(apiRequestMock).toHaveBeenCalledWith("/organizations/org-1", {
      method: "DELETE",
    });
  });
});

describe("registerManager", () => {
  const payload: ManagerRegisterPayload = {
    fullName: "Maria Gestora",
    email: "maria@agro.com",
    password: "Senha@123",
    cpf: "11122233344",
    dateOfBirth: "1990-05-10",
  };

  it("chama apiRequest com o path hierárquico e método POST", async () => {
    apiRequestMock.mockResolvedValue(RAW_MANAGER);

    await registerManager("org-1", payload);

    expect(apiRequestMock).toHaveBeenCalledTimes(1);
    expect(apiRequestMock).toHaveBeenCalledWith(
      "/organizations/org-1/managers",
      {
        method: "POST",
        body: payload,
      },
    );
  });

  it("retorna o Manager mapeado com a organização aninhada", async () => {
    apiRequestMock.mockResolvedValue(RAW_MANAGER);

    const manager = await registerManager("org-1", payload);

    expect(manager).toEqual({
      id: "mgr-1",
      user: {
        id: "usr-1",
        fullName: "Maria Gestora",
        email: "maria@agro.com",
        cpf: "11122233344",
        role: "MANAGER",
        dateOfBirth: "1990-05-10",
      },
      organization: {
        id: "org-1",
        name: "Cooperativa Vale Verde",
        taxId: "12345678000199",
        type: "COOP",
      },
    });
  });
});

describe("parseOrganizationFieldErrors", () => {
  it("extrai os dois campos de uma mensagem com ';' e ':'", () => {
    expect(
      parseOrganizationFieldErrors({
        message: "name: campo obrigatório; taxId: já existe",
      }),
    ).toEqual({
      name: "campo obrigatório",
      taxId: "já existe",
    });
  });

  it("retorna {} para mensagem de frase única sem ':'", () => {
    expect(
      parseOrganizationFieldErrors({
        message: "Não foi possível concluir a operação",
      }),
    ).toEqual({});
  });

  it("retorna {} para payload que não é objeto", () => {
    expect(parseOrganizationFieldErrors(null)).toEqual({});
    expect(parseOrganizationFieldErrors("erro")).toEqual({});
  });
});

describe("parseManagerRegisterFieldErrors", () => {
  it("extrai os dois campos de uma mensagem com ';' e ':'", () => {
    expect(
      parseManagerRegisterFieldErrors({
        message: "email: já cadastrado; password: muito curta",
      }),
    ).toEqual({
      email: "já cadastrado",
      password: "muito curta",
    });
  });

  it("retorna {} para mensagem de frase única sem ':'", () => {
    expect(
      parseManagerRegisterFieldErrors({
        message: "Erro interno do servidor",
      }),
    ).toEqual({});
  });
});
