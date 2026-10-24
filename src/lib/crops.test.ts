import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api";
import {
  createCrop,
  getCrop,
  unitFactorKg,
  unitLabel,
  updateCrop,
  type CropWritePayload,
} from "@/lib/crops";

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
}));

const apiRequestMock = vi.mocked(apiRequest);

const RAW_CROP = {
  id: "crop-1",
  name: "Milho",
  variety: "Híbrido",
  isPriority: true,
  cycleDays: 120,
  expectedProductivity: "6500.50",
  harvestType: "SINGLE",
  unit: "SACK",
  unitWeightKg: "60",
};

const FULL_PAYLOAD: CropWritePayload = {
  name: "Milho",
  variety: "Híbrido",
  isPriority: true,
  cycleDays: 120,
  expectedProductivity: 6500.5,
  harvestType: "SINGLE",
  unit: "SACK",
  unitWeightKg: 60,
};

beforeEach(() => {
  apiRequestMock.mockReset();
});

describe("mapCrop (UNIT-001)", () => {
  it("lê os 9 campos do CropResponseDTO e normaliza decimais em string", async () => {
    apiRequestMock.mockResolvedValue(RAW_CROP);
    const crop = await getCrop("crop-1");
    expect(crop).toEqual({
      id: "crop-1",
      name: "Milho",
      variety: "Híbrido",
      isPriority: true,
      cycleDays: 120,
      expectedProductivity: 6500.5,
      harvestType: "SINGLE",
      unit: "SACK",
      unitWeightKg: 60,
    });
  });

  it("enum desconhecido vira null e campos ausentes viram null", async () => {
    apiRequestMock.mockResolvedValue({
      id: "c2",
      name: "Soja",
      variety: "X",
      isPriority: false,
      harvestType: "WEEKLY",
      unit: "BARREL",
    });
    const crop = await getCrop("c2");
    expect(crop.harvestType).toBeNull();
    expect(crop.unit).toBeNull();
    expect(crop.cycleDays).toBeNull();
    expect(crop.expectedProductivity).toBeNull();
    expect(crop.unitWeightKg).toBeNull();
  });
});

describe("updatedAt (UNIT-005)", () => {
  it("mapeia updatedAt e createdAt quando a API envia", async () => {
    apiRequestMock.mockResolvedValue({
      ...RAW_CROP,
      updatedAt: "2026-10-01T12:00:00Z",
      createdAt: "2026-09-01T12:00:00Z",
    });
    const crop = await getCrop("crop-1");
    expect(crop.updatedAt).toBe("2026-10-01T12:00:00Z");
    expect(crop.createdAt).toBe("2026-09-01T12:00:00Z");
  });
});

describe("payload de escrita (UNIT-002)", () => {
  it("createCrop envia os 8 campos de escrita em POST /crops/register", async () => {
    apiRequestMock.mockResolvedValue(RAW_CROP);
    await createCrop(FULL_PAYLOAD);
    expect(apiRequestMock).toHaveBeenCalledWith("/crops/register", {
      method: "POST",
      body: FULL_PAYLOAD,
    });
    expect(Object.keys(FULL_PAYLOAD)).toHaveLength(8);
  });

  it("updateCrop envia os 8 campos em PATCH /crops/{id}", async () => {
    apiRequestMock.mockResolvedValue(RAW_CROP);
    await updateCrop("crop-1", FULL_PAYLOAD);
    expect(apiRequestMock).toHaveBeenCalledWith("/crops/crop-1", {
      method: "PATCH",
      body: FULL_PAYLOAD,
    });
  });
});

describe("unitFactorKg (UNIT-003)", () => {
  it("KG=1, TON=1000, SACK/BOX=unitWeightKg, null=1, SACK sem peso=null", () => {
    expect(unitFactorKg({ unit: "KG", unitWeightKg: null })).toBe(1);
    expect(unitFactorKg({ unit: "TON", unitWeightKg: null })).toBe(1000);
    expect(unitFactorKg({ unit: "SACK", unitWeightKg: 60 })).toBe(60);
    expect(unitFactorKg({ unit: "BOX", unitWeightKg: 20 })).toBe(20);
    expect(unitFactorKg({ unit: null, unitWeightKg: null })).toBe(1);
    expect(unitFactorKg({ unit: "SACK", unitWeightKg: null })).toBeNull();
    expect(unitFactorKg({ unit: "BOX", unitWeightKg: 0 })).toBeNull();
  });

  it("unitLabel devolve rótulos em português", () => {
    expect(unitLabel("BOX", 12)).toBe("caixas");
    expect(unitLabel("BOX", 1)).toBe("caixa");
    expect(unitLabel("SACK", 2)).toBe("sacas");
    expect(unitLabel("KG", 2)).toBe("kg");
    expect(unitLabel("TON", 2)).toBe("t");
    expect(unitLabel(null, 2)).toBe("kg");
  });
});
