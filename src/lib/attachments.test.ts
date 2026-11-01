import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as api from "@/lib/api";
import {
  ATTACHMENT_MESSAGES,
  clientIdFor,
  deleteAttachment,
  downloadAttachment,
  formatFileSize,
  listAttachments,
  uploadAttachment,
  validateImageFile,
} from "@/lib/attachments";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, apiRequest: vi.fn(), apiUpload: vi.fn(), apiDownload: vi.fn() };
});

const RAW = {
  id: "a-1",
  productionExecutionId: "e-1",
  clientId: "c-1",
  filename: "foto.png",
  contentType: "image/png",
  sizeBytes: 1234,
  url: "/production-executions/e-1/attachments/a-1",
  createdAt: "2026-11-01T10:00:00",
};

function img(type = "image/png", size = 10, name = "foto.png") {
  return new File([new Uint8Array(size)], name, { type });
}

beforeEach(() => {
  vi.mocked(api.apiRequest).mockResolvedValue([RAW]);
  vi.mocked(api.apiUpload).mockResolvedValue(RAW);
});

afterEach(() => vi.clearAllMocks());

describe("attachments — rotas (UNIT-002)", () => {
  it("lista com GET e mapeia os campos", async () => {
    const list = await listAttachments("e-1");
    expect(api.apiRequest).toHaveBeenCalledWith(
      "/production-executions/e-1/attachments",
      { method: "GET" },
    );
    expect(list).toEqual([
      {
        id: "a-1",
        executionId: "e-1",
        clientId: "c-1",
        filename: "foto.png",
        contentType: "image/png",
        sizeBytes: 1234,
        createdAt: "2026-11-01T10:00:00",
      },
    ]);
  });

  it("lista vazia vira []", async () => {
    vi.mocked(api.apiRequest).mockResolvedValue([]);
    expect(await listAttachments("e-1")).toEqual([]);
  });

  it("envia a parte file com o clientId na query", async () => {
    const file = img();
    const created = await uploadAttachment("e-1", file);
    const [path, body] = vi.mocked(api.apiUpload).mock.calls[0];
    expect(path).toMatch(
      /^\/production-executions\/e-1\/attachments\?clientId=[0-9a-f-]{36}$/,
    );
    expect((body as FormData).get("file")).toBe(file);
    expect(created.id).toBe("a-1");
  });

  it("nova tentativa do mesmo arquivo reusa o clientId; após o sucesso gera outro", async () => {
    const file = img();
    vi.mocked(api.apiUpload).mockRejectedValueOnce(new Error("rede"));
    await expect(uploadAttachment("e-1", file)).rejects.toThrow("rede");
    await uploadAttachment("e-1", file);
    const first = vi.mocked(api.apiUpload).mock.calls[0][0];
    const second = vi.mocked(api.apiUpload).mock.calls[1][0];
    expect(second).toBe(first);
    expect(clientIdFor(file)).not.toBe(first.split("clientId=")[1]);
  });

  it("baixa pelo binário autenticado e exclui com DELETE", async () => {
    await downloadAttachment("e-1", "a-1", "foto.png");
    expect(api.apiDownload).toHaveBeenCalledWith(
      "/production-executions/e-1/attachments/a-1",
      "foto.png",
    );
    await deleteAttachment("e-1", "a-1");
    expect(api.apiRequest).toHaveBeenLastCalledWith(
      "/production-executions/e-1/attachments/a-1",
      { method: "DELETE" },
    );
  });
});

describe("validateImageFile (UNIT-002)", () => {
  it.each(["image/jpeg", "image/png", "image/webp"])("aceita %s", (type) => {
    expect(validateImageFile(img(type), 0)).toBeNull();
  });

  it("recusa PDF, vazio, acima de 5 MB e o 6º anexo", () => {
    expect(validateImageFile(img("application/pdf"), 0)).toBe(ATTACHMENT_MESSAGES.format);
    expect(validateImageFile(img("image/png", 0), 0)).toBe(ATTACHMENT_MESSAGES.empty);
    expect(validateImageFile(img("image/png", 5 * 1024 * 1024 + 1), 0)).toBe(
      ATTACHMENT_MESSAGES.size,
    );
    expect(validateImageFile(img("image/png", 5 * 1024 * 1024), 0)).toBeNull();
    expect(validateImageFile(img(), 5)).toBe(ATTACHMENT_MESSAGES.limit);
    expect(validateImageFile(img(), 4)).toBeNull();
  });
});

describe("formatFileSize", () => {
  it("formata B, KB e MB", () => {
    expect(formatFileSize(500)).toBe("500 B");
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe("1,5 MB");
  });
});
