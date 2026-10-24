import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api";
import {
  FINANCING_STATUSES,
  FINANCING_STATUS_LABELS,
  createFamilyMember,
  createFinancing,
  deleteFamilyMember,
  deleteFinancing,
  formatCurrency,
  listFamilyMembers,
  listFinancings,
  mapFinancing,
  parseAmountInput,
  parseSocialFieldErrors,
  updateFamilyMember,
  updateFinancing,
} from "@/lib/farmer-social";

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }));

const apiRequestMock = vi.mocked(apiRequest);

const RAW_MEMBER = {
  id: "m-1",
  farmerId: "f-1",
  name: "Maria da Silva",
  kinship: "Esposa",
  age: 42,
  createdAt: "2026-10-01T10:00:00",
  updatedAt: "2026-10-01T10:00:00",
};

const RAW_FINANCING = {
  id: "fin-1",
  farmerId: "f-1",
  description: "PRONAF Custeio",
  status: "APPROVED",
  amount: 25000,
  createdAt: "2026-10-01T10:00:00",
  updatedAt: "2026-10-01T10:00:00",
};

beforeEach(() => {
  apiRequestMock.mockReset();
});

describe("composição familiar — chamadas (UNIT-001)", () => {
  it("lista com GET e mapeia o membro", async () => {
    apiRequestMock.mockResolvedValue([RAW_MEMBER]);
    const members = await listFamilyMembers("f-1");
    expect(apiRequestMock).toHaveBeenCalledWith(
      "/farmers/f-1/family-compositions",
      { method: "GET" },
    );
    expect(members).toEqual([
      {
        id: "m-1",
        farmerId: "f-1",
        name: "Maria da Silva",
        kinship: "Esposa",
        age: 42,
        createdAt: "2026-10-01T10:00:00",
        updatedAt: "2026-10-01T10:00:00",
      },
    ]);
  });

  it("cadastra com POST, edita com PUT e exclui com DELETE", async () => {
    apiRequestMock.mockResolvedValue(RAW_MEMBER);
    const payload = { name: "Maria da Silva", kinship: "Esposa", age: 42 };
    await createFamilyMember("f-1", payload);
    expect(apiRequestMock).toHaveBeenLastCalledWith(
      "/farmers/f-1/family-compositions",
      { method: "POST", body: payload },
    );
    await updateFamilyMember("m-1", payload);
    expect(apiRequestMock).toHaveBeenLastCalledWith("/family-compositions/m-1", {
      method: "PUT",
      body: payload,
    });
    await deleteFamilyMember("m-1");
    expect(apiRequestMock).toHaveBeenLastCalledWith("/family-compositions/m-1", {
      method: "DELETE",
    });
  });

  it("tolera campos ausentes e idade em texto", async () => {
    apiRequestMock.mockResolvedValue([{ id: "m-2", farmerId: "f-1", age: "7" }]);
    const [member] = await listFamilyMembers("f-1");
    expect(member).toMatchObject({ name: "", kinship: "", age: 7, createdAt: null });
  });
});

describe("financiamentos — chamadas, rótulos e moeda (UNIT-001)", () => {
  it("lista com GET e mapeia valor e situação", async () => {
    apiRequestMock.mockResolvedValue([RAW_FINANCING, { ...RAW_FINANCING, id: "x", status: "OUTRO", amount: "10.5" }]);
    const items = await listFinancings("f-1");
    expect(apiRequestMock).toHaveBeenCalledWith("/farmers/f-1/financings", {
      method: "GET",
    });
    expect(items[0]).toMatchObject({ status: "APPROVED", amount: 25000 });
    expect(items[1]).toMatchObject({ status: null, amount: 10.5 });
    expect(mapFinancing({ id: "y", farmerId: "f" }).amount).toBe(0);
  });

  it("cadastra com POST, edita com PUT e exclui com DELETE", async () => {
    apiRequestMock.mockResolvedValue(RAW_FINANCING);
    const payload = {
      description: "PRONAF Custeio",
      status: "APPROVED" as const,
      amount: 25000,
    };
    await createFinancing("f-1", payload);
    expect(apiRequestMock).toHaveBeenLastCalledWith("/farmers/f-1/financings", {
      method: "POST",
      body: payload,
    });
    await updateFinancing("fin-1", payload);
    expect(apiRequestMock).toHaveBeenLastCalledWith("/financings/fin-1", {
      method: "PUT",
      body: payload,
    });
    await deleteFinancing("fin-1");
    expect(apiRequestMock).toHaveBeenLastCalledWith("/financings/fin-1", {
      method: "DELETE",
    });
  });

  it("tem os 6 rótulos de situação", () => {
    expect(FINANCING_STATUSES).toHaveLength(6);
    expect(FINANCING_STATUS_LABELS).toEqual({
      PENDING: "Pendente",
      IN_ANALYSIS: "Em análise",
      APPROVED: "Aprovado",
      REJECTED: "Rejeitado",
      CANCELED: "Cancelado",
      PAID: "Quitado",
    });
  });

  it("formata em reais", () => {
    expect(formatCurrency(25000)).toMatch(/^R\$\s25\.000,00$/);
  });

  it("converte o valor digitado, aceitando vírgula decimal", () => {
    expect(parseAmountInput("1.234,56")).toBe(1234.56);
    expect(parseAmountInput("1234,5")).toBe(1234.5);
    expect(parseAmountInput("1234.50")).toBe(1234.5);
    expect(parseAmountInput("R$ 10")).toBe(10);
    expect(parseAmountInput("")).toBeNull();
    expect(parseAmountInput("abc")).toBeNull();
    expect(parseAmountInput("-5")).toBeNull();
  });
});

describe("parseSocialFieldErrors (UNIT-001)", () => {
  it("extrai erros por campo de 'campo: msg; campo: msg'", () => {
    expect(
      parseSocialFieldErrors({
        message: "name: O nome é obrigatório; age: A idade não pode ser negativa",
      }),
    ).toEqual({
      name: "O nome é obrigatório",
      age: "A idade não pode ser negativa",
    });
  });

  it("devolve vazio sem campo reconhecível", () => {
    expect(parseSocialFieldErrors({ message: "Acesso negado" })).toEqual({});
    expect(parseSocialFieldErrors(null)).toEqual({});
    expect(parseSocialFieldErrors({ message: 3 })).toEqual({});
  });
});
