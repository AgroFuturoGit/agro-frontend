import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api";
import {
  createTechnician,
  getMyAssignedProducers,
  type TechnicianRegisterPayload,
} from "@/lib/technicians";

// Nenhum teste toca a rede: `apiRequest` é sempre mockado.
vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
}));

const apiRequestMock = vi.mocked(apiRequest);

beforeEach(() => {
  apiRequestMock.mockReset();
});

describe("createTechnician", () => {
  const payload: TechnicianRegisterPayload = {
    fullName: "Tânia Técnica",
    email: "tania@agro.com",
    password: "Senha@123",
    cpf: "529.982.247-25",
    registrationType: "CREA",
    registrationNumber: "12345",
    specialty: "Agronomia",
  };

  it("UNIT-006: chama POST /technicians com o TechnicianRegisterDTO (nunca /users/register)", async () => {
    apiRequestMock.mockResolvedValue({ id: "tec-1" });

    await createTechnician(payload);

    expect(apiRequestMock).toHaveBeenCalledExactlyOnceWith("/technicians", {
      method: "POST",
      body: payload,
    });
  });

  it("devolve a resposta do back", async () => {
    const response = { id: "tec-1", user: null };
    apiRequestMock.mockResolvedValue(response);

    await expect(createTechnician(payload)).resolves.toBe(response);
  });
});

describe("getMyAssignedProducers", () => {
  it("chama GET /technicians/me/farmers e mapeia a lista", async () => {
    apiRequestMock.mockResolvedValue([{ id: "p1", localName: "Sítio" }]);

    await expect(getMyAssignedProducers()).resolves.toMatchObject([
      { id: "p1", localName: "Sítio" },
    ]);
    expect(apiRequestMock).toHaveBeenCalledExactlyOnceWith(
      "/technicians/me/farmers",
      { method: "GET" },
    );
  });
});
