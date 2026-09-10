import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api";
import {
  getMyManager,
  mapManager,
  type ManagerApiResponse,
} from "@/lib/managers";

// Nenhum teste pode tocar a rede: `apiRequest` é sempre mockado.
vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
}));

const apiRequestMock = vi.mocked(apiRequest);

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

describe("mapManager", () => {
  it("mapeia user e organization aninhados da response crua", () => {
    expect(mapManager(RAW_MANAGER)).toEqual({
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

  it("normaliza dateOfBirth ausente para null", () => {
    expect(
      mapManager({
        ...RAW_MANAGER,
        user: { ...RAW_MANAGER.user, dateOfBirth: null },
      }).user.dateOfBirth,
    ).toBeNull();
  });

  it("preserva os ids como string (nunca number)", () => {
    const manager = mapManager(RAW_MANAGER);
    expect(typeof manager.id).toBe("string");
    expect(typeof manager.organization.id).toBe("string");
  });
});

describe("getMyManager", () => {
  it("chama apiRequest com /managers/me e método GET", async () => {
    apiRequestMock.mockResolvedValue(RAW_MANAGER);

    await getMyManager();

    expect(apiRequestMock).toHaveBeenCalledTimes(1);
    expect(apiRequestMock).toHaveBeenCalledWith("/managers/me", {
      method: "GET",
    });
  });

  it("retorna o Manager mapeado", async () => {
    apiRequestMock.mockResolvedValue(RAW_MANAGER);

    await expect(getMyManager()).resolves.toEqual(mapManager(RAW_MANAGER));
  });
});
