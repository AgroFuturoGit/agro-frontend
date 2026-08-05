import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api";
import {
  createCommunity,
  listCommunities,
  mapCommunity,
  parseCommunityFieldErrors,
  parseProducerRegisterFieldErrors,
  registerProducer,
  type CommunityApiResponse,
  type ProducerRegisterPayload,
} from "@/lib/communities";

// Nenhum teste pode tocar a rede: `apiRequest` é sempre mockado.
vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
}));

const apiRequestMock = vi.mocked(apiRequest);

const RAW_COMMUNITY: CommunityApiResponse = {
  id: "com-1",
  name: "Comunidade Boa Vista",
  organization: {
    id: "org-1",
    name: "Cooperativa Vale Verde",
    taxId: "12345678000199",
    type: "COOP",
  },
};

beforeEach(() => {
  apiRequestMock.mockReset();
});

describe("mapCommunity", () => {
  it("mapeia a organização aninhada da response crua", () => {
    expect(mapCommunity(RAW_COMMUNITY)).toEqual({
      id: "com-1",
      name: "Comunidade Boa Vista",
      organization: {
        id: "org-1",
        name: "Cooperativa Vale Verde",
        taxId: "12345678000199",
        type: "COOP",
      },
    });
  });
});

describe("createCommunity", () => {
  it("envia organizationId no path e nunca no body", async () => {
    apiRequestMock.mockResolvedValue(RAW_COMMUNITY);

    await createCommunity("org-1", { name: "Comunidade Boa Vista" });

    expect(apiRequestMock).toHaveBeenCalledTimes(1);
    expect(apiRequestMock).toHaveBeenCalledWith(
      "/organizations/org-1/communities",
      {
        method: "POST",
        body: { name: "Comunidade Boa Vista" },
      },
    );

    const [, options] = apiRequestMock.mock.calls[0];
    expect(options?.body).not.toHaveProperty("organizationId");
  });

  it("retorna a comunidade mapeada", async () => {
    apiRequestMock.mockResolvedValue(RAW_COMMUNITY);

    await expect(
      createCommunity("org-1", { name: "Comunidade Boa Vista" }),
    ).resolves.toEqual(mapCommunity(RAW_COMMUNITY));
  });
});

describe("listCommunities", () => {
  it("aplica o filtro ?orgId quando a organização é informada", async () => {
    apiRequestMock.mockResolvedValue([RAW_COMMUNITY]);

    await listCommunities("org-1");

    expect(apiRequestMock).toHaveBeenCalledWith("/communities?orgId=org-1", {
      method: "GET",
    });
  });

  it("não envia query string quando a organização é omitida", async () => {
    apiRequestMock.mockResolvedValue([]);

    await listCommunities();

    expect(apiRequestMock).toHaveBeenCalledWith("/communities", {
      method: "GET",
    });
  });

  it("mapeia cada item da lista", async () => {
    apiRequestMock.mockResolvedValue([RAW_COMMUNITY]);

    await expect(listCommunities("org-1")).resolves.toEqual([
      mapCommunity(RAW_COMMUNITY),
    ]);
  });
});

describe("registerProducer", () => {
  const payload: ProducerRegisterPayload = {
    fullName: "João Produtor",
    email: "joao@agro.com",
    password: "Senha@123",
    cpf: "55566677788",
    dateOfBirth: "1985-03-22",
  };

  it("chama apiRequest com o path hierárquico e método POST", async () => {
    apiRequestMock.mockResolvedValue({
      id: "prod-1",
      aliasName: null,
      isCompliant: null,
      user: {
        id: "usr-2",
        fullName: "João Produtor",
        email: "joao@agro.com",
        cpf: "55566677788",
      },
      community: { id: "com-1", name: "Comunidade Boa Vista" },
    });

    const producer = await registerProducer("com-1", payload);

    expect(apiRequestMock).toHaveBeenCalledWith(
      "/communities/com-1/producers",
      {
        method: "POST",
        body: payload,
      },
    );
    expect(producer).toEqual({
      id: "prod-1",
      aliasName: null,
      isCompliant: null,
      user: {
        id: "usr-2",
        fullName: "João Produtor",
        email: "joao@agro.com",
        cpf: "55566677788",
      },
      community: { id: "com-1", name: "Comunidade Boa Vista" },
    });
  });

  it("normaliza user e community ausentes para null", async () => {
    apiRequestMock.mockResolvedValue({
      id: "prod-2",
      aliasName: null,
      isCompliant: null,
      user: null,
      community: null,
    });

    await expect(registerProducer("com-1", payload)).resolves.toMatchObject({
      user: null,
      community: null,
    });
  });
});

describe("parseCommunityFieldErrors", () => {
  it("extrai os campos de uma mensagem com ';' e ':'", () => {
    expect(
      parseCommunityFieldErrors({
        message: "name: campo obrigatório; organizationId: não encontrada",
      }),
    ).toEqual({
      name: "campo obrigatório",
      organizationId: "não encontrada",
    });
  });

  it("retorna {} para mensagem de frase única sem ':'", () => {
    expect(
      parseCommunityFieldErrors({
        message: "Não foi possível criar a comunidade",
      }),
    ).toEqual({});
  });

  it("retorna {} para payload que não é objeto", () => {
    expect(parseCommunityFieldErrors(undefined)).toEqual({});
  });
});

describe("parseProducerRegisterFieldErrors", () => {
  it("extrai os campos de uma mensagem com ';' e ':'", () => {
    expect(
      parseProducerRegisterFieldErrors({
        message: "email: já cadastrado; cpf: inválido",
      }),
    ).toEqual({
      email: "já cadastrado",
      cpf: "inválido",
    });
  });

  it("retorna {} para mensagem de frase única sem ':'", () => {
    expect(
      parseProducerRegisterFieldErrors({
        message: "Erro inesperado ao registrar produtor",
      }),
    ).toEqual({});
  });
});
