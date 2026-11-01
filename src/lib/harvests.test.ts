import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api";
import {
  createHarvest,
  harvestVersion,
  listHarvests,
  updateHarvest,
} from "@/lib/harvests";

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
}));

const apiRequestMock = vi.mocked(apiRequest);

const RAW = {
  id: "h-1",
  label: "Safra 2031",
  startDate: "2031-01-01",
  endDate: "2031-12-31",
  createdAt: "2026-10-01T08:00:00.123456",
  updatedAt: "2026-10-30T10:15:30.654321",
};

const PAYLOAD = { label: "Safra 2031", startDate: "2031-01-01", endDate: "2031-12-31" };

beforeEach(() => {
  apiRequestMock.mockReset();
});

describe("mapHarvest (UNIT-001)", () => {
  it("guarda createdAt e updatedAt como o back mandou", async () => {
    apiRequestMock.mockResolvedValue([RAW]);
    const [harvest] = await listHarvests();
    expect(harvest).toEqual(RAW);
  });

  it("aceita resposta sem as datas de versão", async () => {
    apiRequestMock.mockResolvedValue([{ ...RAW, createdAt: null, updatedAt: undefined }]);
    const [harvest] = await listHarvests();
    expect(harvest).not.toHaveProperty("updatedAt");
    expect(harvest).not.toHaveProperty("createdAt");
  });
});

describe("harvestVersion e baseUpdatedAt (UNIT-001)", () => {
  it("usa updatedAt, depois createdAt", () => {
    expect(harvestVersion(RAW)).toBe("2026-10-30T10:15:30.654321");
    expect(harvestVersion({ createdAt: RAW.createdAt })).toBe(RAW.createdAt);
    expect(harvestVersion({})).toBeUndefined();
  });

  it("updateHarvest envia baseUpdatedAt quando recebe a versão", async () => {
    apiRequestMock.mockResolvedValue(RAW);
    await updateHarvest("h-1", PAYLOAD, "2026-10-30T10:15:30.654321");
    expect(apiRequestMock).toHaveBeenCalledWith("/harvests/h-1", {
      method: "PATCH",
      body: { ...PAYLOAD, baseUpdatedAt: "2026-10-30T10:15:30.654321" },
    });
  });

  it("updateHarvest sem versão e createHarvest não enviam baseUpdatedAt", async () => {
    apiRequestMock.mockResolvedValue(RAW);
    await updateHarvest("h-1", PAYLOAD);
    await createHarvest(PAYLOAD);
    for (const call of apiRequestMock.mock.calls) {
      expect(call[1]?.body).toEqual(PAYLOAD);
    }
  });
});
