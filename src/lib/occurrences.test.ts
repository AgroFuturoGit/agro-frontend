import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api";
import {
  OCCURRENCE_TYPE_LABELS,
  createOccurrence,
  deleteOccurrence,
  isSafeEvidenceUrl,
  listOccurrences,
  parseOccurrenceFieldErrors,
  updateOccurrence,
} from "@/lib/occurrences";

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }));

const apiRequestMock = vi.mocked(apiRequest);

const RAW = {
  id: "o-1",
  executionId: "e-1",
  logType: "PEST",
  description: "Lagarta do cartucho",
  weatherObservation: "Sol forte",
  evidenceUrl: "https://exemplo.test/a.jpg",
  createdAt: "2026-10-02T09:00:00",
  updatedAt: "2026-10-02T09:00:00",
};

beforeEach(() => {
  apiRequestMock.mockReset();
});

describe("ocorrências — chamadas e mapper (UNIT-001)", () => {
  it("lista com GET e mapeia", async () => {
    apiRequestMock.mockResolvedValue([
      RAW,
      { ...RAW, id: "o-2", logType: "X", weatherObservation: "", evidenceUrl: null },
    ]);
    const items = await listOccurrences("e-1");
    expect(apiRequestMock).toHaveBeenCalledWith(
      "/production-executions/e-1/occurrences",
      { method: "GET" },
    );
    expect(items[0]).toMatchObject({
      logType: "PEST",
      weatherObservation: "Sol forte",
      evidenceUrl: "https://exemplo.test/a.jpg",
    });
    expect(items[1]).toMatchObject({
      logType: null,
      weatherObservation: null,
      evidenceUrl: null,
    });
  });

  it("cadastra com POST, edita com PUT e exclui com DELETE", async () => {
    apiRequestMock.mockResolvedValue(RAW);
    const payload = {
      logType: "PEST" as const,
      description: "Lagarta do cartucho",
      weatherObservation: null,
      evidenceUrl: "https://exemplo.test/a.jpg",
    };
    await createOccurrence("e-1", payload);
    expect(apiRequestMock).toHaveBeenLastCalledWith(
      "/production-executions/e-1/occurrences",
      { method: "POST", body: payload },
    );
    await updateOccurrence("o-1", payload);
    expect(apiRequestMock).toHaveBeenLastCalledWith("/occurrences/o-1", {
      method: "PUT",
      body: payload,
    });
    await deleteOccurrence("o-1");
    expect(apiRequestMock).toHaveBeenLastCalledWith("/occurrences/o-1", {
      method: "DELETE",
    });
  });

  it("tem os 3 rótulos de tipo", () => {
    expect(OCCURRENCE_TYPE_LABELS).toEqual({
      CLIMATE: "Evento climático",
      PEST: "Praga",
      DISEASE: "Doença",
    });
  });

  it("só aceita http(s) como link de evidência", () => {
    expect(isSafeEvidenceUrl("https://a.test/x")).toBe(true);
    expect(isSafeEvidenceUrl("http://a.test/x")).toBe(true);
    expect(isSafeEvidenceUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeEvidenceUrl("data:text/html,x")).toBe(false);
    expect(isSafeEvidenceUrl("ftp://a.test")).toBe(false);
    expect(isSafeEvidenceUrl("não é url")).toBe(false);
    expect(isSafeEvidenceUrl(null)).toBe(false);
  });

  it("extrai erros por campo do 400", () => {
    expect(
      parseOccurrenceFieldErrors({
        message: "description: A descrição é obrigatória; logType: O tipo de ocorrência é obrigatório",
      }),
    ).toEqual({
      description: "A descrição é obrigatória",
      logType: "O tipo de ocorrência é obrigatório",
    });
    expect(parseOccurrenceFieldErrors("x")).toEqual({});
  });
});
