import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api";
import {
  deleteProducer,
  getMyProducer,
  listProducers,
  producerDisplayName,
  updateProducer,
  type ProducerUpdatePayload,
} from "@/lib/producers";

// Nenhum teste pode tocar a rede: `apiRequest` é sempre mockado.
vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
}));

const apiRequestMock = vi.mocked(apiRequest);

const RAW_ORGANIZATION = {
  id: "org-1",
  name: "Cooperativa Boa Vista",
  taxId: "11222333000181",
  type: "COOP",
};

// Resposta no contrato do `FarmerResponseDTO` (Feature 5.2): sem campo de nome de exibição.
const RAW_PRODUCER = {
  id: "prod-1",
  fullName: "João Produtor",
  cpf: "52998224725",
  dateOfBirth: "1985-03-22",
  motherName: "Maria Produtora",
  origin: "Assentamento",
  educationLevel: "Ensino médio",
  phone: "82999990000",
  localName: "Sítio Boa Esperança",
  street: "Estrada Velha, 10",
  city: "Maceió",
  state: "AL",
  ibgeCode: "2704302",
  latitude: -9.66,
  longitude: -35.73,
  isCompliant: true,
  registrationSource: "TECHNICIAN",
  createdAt: "2026-10-01T10:00:00",
  updatedAt: "2026-10-02T10:00:00",
  user: {
    id: "usr-1",
    fullName: "João Produtor",
    email: "joao@agro.com",
    cpf: "52998224725",
  },
  community: {
    id: "com-1",
    name: "Comunidade Boa Vista",
    organization: RAW_ORGANIZATION,
  },
};

const MAPPED_PRODUCER = { ...RAW_PRODUCER };

beforeEach(() => {
  apiRequestMock.mockReset();
});

describe("getMyProducer", () => {
  it("chama apiRequest com /farmers/me e método GET", async () => {
    apiRequestMock.mockResolvedValue(RAW_PRODUCER);

    await getMyProducer();

    expect(apiRequestMock).toHaveBeenCalledExactlyOnceWith("/farmers/me", {
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
      ...MAPPED_PRODUCER,
      user: null,
      community: null,
    });
  });

  it("UNIT-001: lê todos os campos do FarmerResponseDTO e não expõe campo de nome de exibição", async () => {
    apiRequestMock.mockResolvedValue(RAW_PRODUCER);

    const producer = await getMyProducer();

    expect(producer.localName).toBe("Sítio Boa Esperança");
    expect(producer.cpf).toBe("52998224725");
    expect(producer.dateOfBirth).toBe("1985-03-22");
    expect(producer.latitude).toBe(-9.66);
    expect(producer.registrationSource).toBe("TECHNICIAN");
    expect(Object.keys(producer).some((key) => /alias/i.test(key))).toBe(false);
  });

  it("normaliza campos ausentes ou nulos para null", async () => {
    apiRequestMock.mockResolvedValue({ id: "prod-9" });

    const producer = await getMyProducer();

    expect(producer).toMatchObject({
      id: "prod-9",
      fullName: null,
      cpf: null,
      dateOfBirth: null,
      localName: null,
      latitude: null,
      longitude: null,
      isCompliant: null,
      registrationSource: null,
      user: null,
      community: null,
    });
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
  it("sem argumento chama GET /farmers, sem query string", async () => {
    apiRequestMock.mockResolvedValue([]);

    await listProducers();

    expect(apiRequestMock).toHaveBeenCalledExactlyOnceWith("/farmers", {
      method: "GET",
    });
  });

  it("com communityId aplica ?communityId= (contrato real do backend)", async () => {
    apiRequestMock.mockResolvedValue([]);

    await listProducers("community-beta");

    expect(apiRequestMock).toHaveBeenCalledExactlyOnceWith(
      "/farmers?communityId=community-beta",
      { method: "GET" },
    );
  });

  it("faz encode do communityId na query string", async () => {
    apiRequestMock.mockResolvedValue([]);

    await listProducers("a b&c=d");

    expect(apiRequestMock).toHaveBeenCalledExactlyOnceWith(
      "/farmers?communityId=a%20b%26c%3Dd",
      { method: "GET" },
    );
  });

  it("communityId vazio não vira query string", async () => {
    apiRequestMock.mockResolvedValue([]);

    await listProducers("");

    expect(apiRequestMock).toHaveBeenCalledExactlyOnceWith("/farmers", {
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
    fullName: "Novo Nome",
    localName: "Novo endereço",
    phone: "",
    latitude: -9.5,
    longitude: -35.7,
    isCompliant: false,
  };

  it("chama apiRequest com PUT /farmers/{id} e o payload, sem cpf", async () => {
    apiRequestMock.mockResolvedValue(RAW_PRODUCER);

    await updateProducer("prod-1", payload);

    expect(apiRequestMock).toHaveBeenCalledExactlyOnceWith(
      "/farmers/prod-1",
      { method: "PUT", body: payload },
    );
    expect(apiRequestMock.mock.calls[0][1]).not.toHaveProperty("body.cpf");
  });

  it("retorna o Producer mapeado", async () => {
    apiRequestMock.mockResolvedValue({
      ...RAW_PRODUCER,
      localName: "Novo endereço",
      isCompliant: false,
    });

    await expect(updateProducer("prod-1", payload)).resolves.toEqual({
      ...MAPPED_PRODUCER,
      localName: "Novo endereço",
      isCompliant: false,
    });
  });
});

describe("producerDisplayName (BR-001)", () => {
  it("usa o nome do agricultor", () => {
    expect(
      producerDisplayName({ fullName: "Ana", user: { fullName: "Outra" } }),
    ).toBe("Ana");
  });

  it("cai para o nome do usuário quando o do agricultor é vazio", () => {
    expect(
      producerDisplayName({ fullName: " ", user: { fullName: "Outra" } }),
    ).toBe("Outra");
  });

  it("cai para 'Agricultor' sem nenhum nome", () => {
    expect(producerDisplayName({ fullName: null, user: null })).toBe(
      "Agricultor",
    );
    expect(producerDisplayName(null)).toBe("Agricultor");
  });
});

describe("deleteProducer", () => {
  it("chama apiRequest com DELETE /farmers/{id}", async () => {
    apiRequestMock.mockResolvedValue(undefined);

    await deleteProducer("prod-1");

    expect(apiRequestMock).toHaveBeenCalledExactlyOnceWith(
      "/farmers/prod-1",
      { method: "DELETE" },
    );
  });
});
