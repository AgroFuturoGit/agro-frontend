import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api";
import {
  deleteProducer,
  getMyProducer,
  listProducers,
  updateProducer,
  type ProducerUpdatePayload,
} from "@/lib/producers";

// Nenhum teste pode tocar a rede: `apiRequest` é sempre mockado.
vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
}));

const apiRequestMock = vi.mocked(apiRequest);

const RAW_PRODUCER = {
  id: "prod-1",
  aliasName: "Sítio Boa Esperança",
  isCompliant: true,
  user: {
    id: "usr-1",
    fullName: "João Produtor",
    email: "joao@agro.com",
    cpf: "55566677788",
  },
  community: { id: "com-1", name: "Comunidade Boa Vista" },
};

const MAPPED_PRODUCER = {
  id: "prod-1",
  aliasName: "Sítio Boa Esperança",
  isCompliant: true,
  user: {
    id: "usr-1",
    fullName: "João Produtor",
    email: "joao@agro.com",
    cpf: "55566677788",
  },
  community: { id: "com-1", name: "Comunidade Boa Vista" },
};

beforeEach(() => {
  apiRequestMock.mockReset();
});

describe("getMyProducer", () => {
  it("chama apiRequest com /producers/me e método GET", async () => {
    apiRequestMock.mockResolvedValue(RAW_PRODUCER);

    await getMyProducer();

    expect(apiRequestMock).toHaveBeenCalledExactlyOnceWith("/producers/me", {
      method: "GET",
    });
  });

  it("retorna o Producer mapeado", async () => {
    apiRequestMock.mockResolvedValue(RAW_PRODUCER);

    await expect(getMyProducer()).resolves.toEqual(MAPPED_PRODUCER);
  });

  it("normaliza user e community ausentes para null", async () => {
    apiRequestMock.mockResolvedValue({
      ...RAW_PRODUCER,
      user: null,
      community: null,
    });

    await expect(getMyProducer()).resolves.toEqual({
      id: "prod-1",
      aliasName: "Sítio Boa Esperança",
      isCompliant: true,
      user: null,
      community: null,
    });
  });

  it("normaliza aliasName e isCompliant ausentes para null", async () => {
    apiRequestMock.mockResolvedValue({
      ...RAW_PRODUCER,
      aliasName: null,
      isCompliant: null,
    });

    const producer = await getMyProducer();

    expect(producer.aliasName).toBeNull();
    expect(producer.isCompliant).toBeNull();
  });

  it("preserva os ids como string (nunca number)", async () => {
    apiRequestMock.mockResolvedValue(RAW_PRODUCER);

    const producer = await getMyProducer();

    expect(typeof producer.id).toBe("string");
    expect(typeof producer.user?.id).toBe("string");
    expect(typeof producer.community?.id).toBe("string");
  });
});

describe("listProducers", () => {
  it("sem argumento chama GET /producers, sem query string", async () => {
    apiRequestMock.mockResolvedValue([]);

    await listProducers();

    expect(apiRequestMock).toHaveBeenCalledExactlyOnceWith("/producers", {
      method: "GET",
    });
  });

  it("com communityId aplica ?communityId= (contrato real do backend)", async () => {
    apiRequestMock.mockResolvedValue([]);

    await listProducers("community-beta");

    expect(apiRequestMock).toHaveBeenCalledExactlyOnceWith(
      "/producers?communityId=community-beta",
      { method: "GET" },
    );
  });

  it("faz encode do communityId na query string", async () => {
    apiRequestMock.mockResolvedValue([]);

    await listProducers("a b&c=d");

    expect(apiRequestMock).toHaveBeenCalledExactlyOnceWith(
      "/producers?communityId=a%20b%26c%3Dd",
      { method: "GET" },
    );
  });

  it("communityId vazio não vira query string", async () => {
    apiRequestMock.mockResolvedValue([]);

    await listProducers("");

    expect(apiRequestMock).toHaveBeenCalledExactlyOnceWith("/producers", {
      method: "GET",
    });
  });

  it("mapeia cada item da lista", async () => {
    apiRequestMock.mockResolvedValue([
      RAW_PRODUCER,
      { ...RAW_PRODUCER, id: "prod-2" },
    ]);

    await expect(listProducers()).resolves.toEqual([
      MAPPED_PRODUCER,
      { ...MAPPED_PRODUCER, id: "prod-2" },
    ]);
  });

  it("normaliza user e community nulos de cada item", async () => {
    apiRequestMock.mockResolvedValue([
      { ...RAW_PRODUCER, user: null, community: null },
    ]);

    await expect(listProducers()).resolves.toMatchObject([
      { id: "prod-1", user: null, community: null },
    ]);
  });

  it("lista vazia devolve array vazio", async () => {
    apiRequestMock.mockResolvedValue([]);

    await expect(listProducers()).resolves.toEqual([]);
  });
});

describe("updateProducer", () => {
  const payload: ProducerUpdatePayload = {
    aliasName: "Novo apelido",
    isCompliant: false,
  };

  it("chama apiRequest com PUT /producers/{id} e o payload", async () => {
    apiRequestMock.mockResolvedValue(RAW_PRODUCER);

    await updateProducer("prod-1", payload);

    expect(apiRequestMock).toHaveBeenCalledExactlyOnceWith(
      "/producers/prod-1",
      { method: "PUT", body: payload },
    );
  });

  it("retorna o Producer mapeado", async () => {
    apiRequestMock.mockResolvedValue({
      ...RAW_PRODUCER,
      aliasName: "Novo apelido",
      isCompliant: false,
    });

    await expect(updateProducer("prod-1", payload)).resolves.toEqual({
      ...MAPPED_PRODUCER,
      aliasName: "Novo apelido",
      isCompliant: false,
    });
  });
});

describe("deleteProducer", () => {
  it("chama apiRequest com DELETE /producers/{id}", async () => {
    apiRequestMock.mockResolvedValue(undefined);

    await deleteProducer("prod-1");

    expect(apiRequestMock).toHaveBeenCalledExactlyOnceWith(
      "/producers/prod-1",
      { method: "DELETE" },
    );
  });
});
