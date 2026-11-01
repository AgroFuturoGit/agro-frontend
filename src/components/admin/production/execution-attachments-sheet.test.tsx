import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

import { ExecutionAttachmentsSheet } from "@/components/admin/production/execution-attachments-sheet";
import { ApiError } from "@/lib/api";
import {
  ATTACHMENT_MESSAGES,
  deleteAttachment,
  downloadAttachment,
  listAttachments,
  uploadAttachment,
  type ExecutionAttachment,
} from "@/lib/attachments";
import { saveBlob } from "@/lib/download";
import type { ProductionExecution } from "@/lib/production";

vi.mock("@/lib/attachments", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/attachments")>("@/lib/attachments");
  return {
    ...actual,
    listAttachments: vi.fn(),
    uploadAttachment: vi.fn(),
    downloadAttachment: vi.fn(),
    deleteAttachment: vi.fn(),
  };
});
vi.mock("@/lib/download", () => ({ saveBlob: vi.fn() }));

const EXECUTION: ProductionExecution = {
  id: "exec-1",
  productionPlanId: "plan-1",
  quantity: 12,
  quantityKg: 240,
  harvestedAt: "2026-05-10",
  status: "PENDING",
  notes: null,
  rejectionReason: null,
  validatedBy: null,
  validatedAt: null,
  createdAt: null,
  updatedAt: null,
};

function att(n: number, executionId = "exec-1"): ExecutionAttachment {
  return {
    id: `a-${n}`,
    executionId,
    clientId: null,
    filename: `foto-${n}.png`,
    contentType: "image/png",
    sizeBytes: 2048,
    createdAt: "2026-11-01T10:00:00",
  };
}

function file(name: string, type: string, size = 10) {
  return new File([new Uint8Array(size)], name, { type });
}

let urlCounter = 0;
const createObjectURL = vi.fn(() => `blob:preview-${++urlCounter}`);
const revokeObjectURL = vi.fn();

beforeEach(() => {
  urlCounter = 0;
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL }));
  Object.assign(URL, { createObjectURL, revokeObjectURL });
  vi.mocked(listAttachments).mockResolvedValue([att(1)]);
  vi.mocked(downloadAttachment).mockResolvedValue({
    blob: new Blob(["x"], { type: "image/png" }),
    filename: "foto-1.png",
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

function renderSheet(canWrite: boolean, execution: ProductionExecution | null = EXECUTION, open = true) {
  const ui = (exec: ProductionExecution | null, isOpen: boolean) => (
    <ExecutionAttachmentsSheet
      execution={exec}
      open={isOpen}
      onOpenChange={vi.fn()}
      canWrite={canWrite}
    />
  );
  const result = render(ui(execution, open));
  return { ...result, ui };
}

function input() {
  return screen.getByTestId("attachment-input") as HTMLInputElement;
}

describe("ExecutionAttachmentsSheet — estados (UNIT-003)", () => {
  it("mostra carregando, depois a lista com miniaturas pelo nome do arquivo", async () => {
    let resolve: (v: ExecutionAttachment[]) => void = () => {};
    vi.mocked(listAttachments).mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    renderSheet(false);
    expect(await screen.findByRole("status", { name: "Carregando fotos" })).toBeInTheDocument();
    resolve([att(1), att(2)]);
    const img = await screen.findByAltText("foto-1.png");
    expect(screen.getByAltText("foto-2.png")).toBeInTheDocument();
    await waitFor(() => expect(img).toHaveAttribute("src", expect.stringMatching(/^blob:preview-/)));
    expect(listAttachments).toHaveBeenCalledWith("exec-1");
    expect(downloadAttachment).toHaveBeenCalledWith("exec-1", "a-1", "foto-1.png");
    expect(screen.getAllByText("2 KB · 01/11/2026")).toHaveLength(2);
  });

  it("estado vazio", async () => {
    vi.mocked(listAttachments).mockResolvedValue([]);
    renderSheet(true);
    expect(await screen.findByText("Nenhuma foto anexada.")).toBeInTheDocument();
  });

  it("erro com Tentar novamente recarrega", async () => {
    vi.mocked(listAttachments).mockRejectedValueOnce(new ApiError(500, "Falha ao listar", null));
    renderSheet(true);
    expect(await screen.findByText("Falha ao listar")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByAltText("foto-1.png")).toBeInTheDocument();
    expect(listAttachments).toHaveBeenCalledTimes(2);
  });

  it("falha na prévia mostra aviso sem quebrar a lista", async () => {
    vi.mocked(downloadAttachment).mockRejectedValue(new ApiError(500, "x", null));
    renderSheet(false);
    expect(await screen.findByText("Prévia indisponível")).toBeInTheDocument();
    expect(screen.getByText("foto-1.png")).toBeInTheDocument();
  });
});

describe("ExecutionAttachmentsSheet — papéis (UNIT-005)", () => {
  it("quem escreve vê Enviar fotos (accept e múltiplos) e Excluir", async () => {
    renderSheet(true);
    await screen.findByAltText("foto-1.png");
    expect(screen.getByRole("button", { name: "Enviar fotos" })).toBeEnabled();
    expect(input()).toHaveAttribute("accept", "image/jpeg,image/png,image/webp");
    expect(input()).toHaveAttribute("multiple");
    expect(screen.getByRole("button", { name: "Excluir foto-1.png" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Baixar foto-1.png" })).toBeInTheDocument();
  });

  it("MANAGER / role desconhecida só vê e baixa", async () => {
    renderSheet(false);
    await screen.findByAltText("foto-1.png");
    expect(screen.queryByRole("button", { name: /Enviar fotos/ })).toBeNull();
    expect(screen.queryByTestId("attachment-input")).toBeNull();
    expect(screen.queryByRole("button", { name: /Excluir/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Baixar foto-1.png" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir foto-1.png" })).toBeInTheDocument();
  });
});

describe("ExecutionAttachmentsSheet — envio (UNIT-004)", () => {
  it("envia a foto válida e recarrega a lista", async () => {
    vi.mocked(listAttachments).mockResolvedValueOnce([]).mockResolvedValueOnce([att(1)]);
    vi.mocked(uploadAttachment).mockResolvedValue(att(1));
    renderSheet(true);
    await screen.findByText("Nenhuma foto anexada.");
    const png = file("nova.png", "image/png");
    fireEvent.change(input(), { target: { files: [png] } });
    await waitFor(() => expect(uploadAttachment).toHaveBeenCalledWith("exec-1", png));
    expect(await screen.findByAltText("foto-1.png")).toBeInTheDocument();
  });

  it("recusa PDF e arquivo acima de 5 MB sem chamar a API", async () => {
    vi.mocked(listAttachments).mockResolvedValue([]);
    renderSheet(true);
    await screen.findByText("Nenhuma foto anexada.");
    fireEvent.change(input(), {
      target: {
        files: [file("doc.pdf", "application/pdf"), file("grande.jpg", "image/jpeg", 5 * 1024 * 1024 + 1)],
      },
    });
    expect(
      await screen.findByText(`doc.pdf: ${ATTACHMENT_MESSAGES.format}`),
    ).toBeInTheDocument();
    expect(screen.getByText(`grande.jpg: ${ATTACHMENT_MESSAGES.size}`)).toBeInTheDocument();
    expect(uploadAttachment).not.toHaveBeenCalled();
  });

  it("com 5 fotos o envio fica bloqueado com a mensagem do limite", async () => {
    vi.mocked(listAttachments).mockResolvedValue([1, 2, 3, 4, 5].map((n) => att(n)));
    renderSheet(true);
    await screen.findByAltText("foto-5.png");
    expect(screen.getByRole("button", { name: "Enviar fotos" })).toBeDisabled();
    expect(screen.getByText(ATTACHMENT_MESSAGES.limit)).toBeInTheDocument();
  });

  it("várias fotos de uma vez respeitam o limite restante", async () => {
    vi.mocked(listAttachments).mockResolvedValue([1, 2, 3, 4].map((n) => att(n)));
    vi.mocked(uploadAttachment).mockResolvedValue(att(5));
    renderSheet(true);
    await screen.findByAltText("foto-4.png");
    const a = file("a.png", "image/png");
    const b = file("b.png", "image/png");
    fireEvent.change(input(), { target: { files: [a, b] } });
    expect(await screen.findByText(`b.png: ${ATTACHMENT_MESSAGES.limit}`)).toBeInTheDocument();
    expect(uploadAttachment).toHaveBeenCalledTimes(1);
    expect(uploadAttachment).toHaveBeenCalledWith("exec-1", a);
  });

  it("mostra a mensagem do back quando o envio falha", async () => {
    vi.mocked(listAttachments).mockResolvedValue([]);
    vi.mocked(uploadAttachment).mockRejectedValue(
      new ApiError(400, "O arquivo enviado está vazio.", null),
    );
    renderSheet(true);
    await screen.findByText("Nenhuma foto anexada.");
    fireEvent.change(input(), { target: { files: [file("x.png", "image/png")] } });
    expect(
      await screen.findByText("x.png: O arquivo enviado está vazio."),
    ).toBeInTheDocument();
  });
});

describe("ExecutionAttachmentsSheet — abrir, baixar e excluir (UNIT-003)", () => {
  it("Abrir mostra a imagem ampliada num diálogo com o nome como título", async () => {
    renderSheet(false);
    await screen.findByAltText("foto-1.png");
    await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Abrir foto-1.png" }));
    const dialog = await screen.findByRole("dialog", { name: "foto-1.png" });
    expect(within(dialog).getByAltText("foto-1.png")).toBeInTheDocument();
  });

  it("Baixar salva com o nome do anexo", async () => {
    renderSheet(false);
    await screen.findByAltText("foto-1.png");
    fireEvent.click(screen.getByRole("button", { name: "Baixar foto-1.png" }));
    await waitFor(() => expect(saveBlob).toHaveBeenCalledTimes(1));
    expect(vi.mocked(saveBlob).mock.calls[0][1]).toBe("foto-1.png");
  });

  it("Baixar usa o nome saneado devolvido por apiDownload, não o nome cru da lista", async () => {
    vi.mocked(listAttachments).mockResolvedValue([{ ...att(1), filename: "../../etc/foto.png" }]);
    vi.mocked(downloadAttachment).mockResolvedValue({
      blob: new Blob(["x"], { type: "image/png" }),
      filename: "foto.png",
    });
    renderSheet(false);
    await screen.findByAltText("../../etc/foto.png");
    fireEvent.click(screen.getByRole("button", { name: "Baixar ../../etc/foto.png" }));
    await waitFor(() => expect(saveBlob).toHaveBeenCalledTimes(1));
    expect(vi.mocked(saveBlob).mock.calls[0][1]).toBe("foto.png");
  });

  it("Excluir revoga a Object URL do anexo na hora", async () => {
    let resolveList: (v: ExecutionAttachment[]) => void = () => {};
    vi.mocked(listAttachments)
      .mockResolvedValueOnce([att(1)])
      .mockReturnValueOnce(
        new Promise((r) => {
          resolveList = r;
        }),
      );
    vi.mocked(deleteAttachment).mockResolvedValue(undefined);
    renderSheet(true);
    await screen.findByAltText("foto-1.png");
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Excluir foto-1.png" }));
    const alert = await screen.findByRole("alertdialog");
    fireEvent.click(within(alert).getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith("blob:preview-1"));
    resolveList([]);
    expect(await screen.findByText("Nenhuma foto anexada.")).toBeInTheDocument();
  });

  it("Excluir pede confirmação e só então apaga e recarrega", async () => {
    vi.mocked(listAttachments).mockResolvedValueOnce([att(1)]).mockResolvedValueOnce([]);
    vi.mocked(deleteAttachment).mockResolvedValue(undefined);
    renderSheet(true);
    await screen.findByAltText("foto-1.png");
    fireEvent.click(screen.getByRole("button", { name: "Excluir foto-1.png" }));
    const alert = await screen.findByRole("alertdialog");
    expect(within(alert).getByText("Excluir foto?")).toBeInTheDocument();
    expect(deleteAttachment).not.toHaveBeenCalled();
    fireEvent.click(within(alert).getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(deleteAttachment).toHaveBeenCalledWith("exec-1", "a-1"));
    expect(await screen.findByText("Nenhuma foto anexada.")).toBeInTheDocument();
  });

  it("anexo já removido (404) recarrega a lista", async () => {
    vi.mocked(listAttachments).mockResolvedValueOnce([att(1)]).mockResolvedValueOnce([]);
    vi.mocked(deleteAttachment).mockRejectedValue(new ApiError(404, "não existe", null));
    renderSheet(true);
    await screen.findByAltText("foto-1.png");
    fireEvent.click(screen.getByRole("button", { name: "Excluir foto-1.png" }));
    const alert = await screen.findByRole("alertdialog");
    fireEvent.click(within(alert).getByRole("button", { name: "Excluir" }));
    expect(await screen.findByText("Nenhuma foto anexada.")).toBeInTheDocument();
  });

  it("outro erro ao excluir fica visível na confirmação", async () => {
    vi.mocked(deleteAttachment).mockRejectedValue(new ApiError(403, "Sem permissão", null));
    renderSheet(true);
    await screen.findByAltText("foto-1.png");
    fireEvent.click(screen.getByRole("button", { name: "Excluir foto-1.png" }));
    const alert = await screen.findByRole("alertdialog");
    fireEvent.click(within(alert).getByRole("button", { name: "Excluir" }));
    expect(await within(alert).findByText("Sem permissão")).toBeInTheDocument();
  });
});

describe("ExecutionAttachmentsSheet — Object URLs (UNIT-006)", () => {
  it("libera as URLs ao fechar o sheet", async () => {
    const { rerender, ui } = renderSheet(false);
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
    rerender(ui(EXECUTION, false));
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith("blob:preview-1"));
  });

  it("libera as URLs ao trocar de apontamento e não mistura as fotos", async () => {
    const other: ProductionExecution = { ...EXECUTION, id: "exec-2" };
    vi.mocked(listAttachments).mockImplementation(async (id: string) =>
      id === "exec-1" ? [att(1)] : [att(9, "exec-2")],
    );
    const { rerender, ui } = renderSheet(false);
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
    rerender(ui(other, true));
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith("blob:preview-1"));
    expect(await screen.findByAltText("foto-9.png")).toBeInTheDocument();
    expect(screen.queryByAltText("foto-1.png")).toBeNull();
  });

  it("prévia que chega depois de fechar não vaza URL", async () => {
    let resolveBlob: (v: { blob: Blob; filename: string }) => void = () => {};
    vi.mocked(downloadAttachment).mockReturnValue(
      new Promise((r) => {
        resolveBlob = r;
      }),
    );
    const { rerender, ui } = renderSheet(false);
    await waitFor(() => expect(downloadAttachment).toHaveBeenCalled());
    rerender(ui(EXECUTION, false));
    resolveBlob({ blob: new Blob(["x"]), filename: "foto-1.png" });
    await Promise.resolve();
    await Promise.resolve();
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});

describe("ExecutionAttachmentsSheet — troca de apontamento (UNIT-001)", () => {
  const other: ProductionExecution = { ...EXECUTION, id: "exec-2" };

  it("envio que termina depois de fechar e reabrir em outro apontamento não mistura fotos", async () => {
    let finishUpload: (v: ExecutionAttachment) => void = () => {};
    vi.mocked(uploadAttachment).mockReturnValue(
      new Promise((r) => {
        finishUpload = r;
      }),
    );
    vi.mocked(listAttachments).mockImplementation(async (id: string) =>
      id === "exec-1" ? [att(1)] : [att(9, "exec-2")],
    );
    const { rerender, ui } = renderSheet(true);
    await screen.findByAltText("foto-1.png");
    fireEvent.change(input(), { target: { files: [file("nova.png", "image/png")] } });
    await waitFor(() => expect(uploadAttachment).toHaveBeenCalledTimes(1));

    rerender(ui(null, false));
    rerender(ui(other, true));
    expect(await screen.findByAltText("foto-9.png")).toBeInTheDocument();
    const listCalls = vi.mocked(listAttachments).mock.calls.length;

    finishUpload(att(2));
    await new Promise((r) => setTimeout(r, 20));

    expect(screen.getByAltText("foto-9.png")).toBeInTheDocument();
    expect(screen.queryByAltText("foto-1.png")).toBeNull();
    expect(vi.mocked(listAttachments).mock.calls.length).toBe(listCalls);
    // O envio do apontamento antigo não deixa o botão do novo preso em "Enviando…".
    expect(screen.getByRole("button", { name: "Enviar fotos" })).toBeEnabled();
  });

  it("reabrir em outro apontamento não pede miniatura com o id do anterior", async () => {
    vi.mocked(listAttachments).mockImplementation(async (id: string) =>
      id === "exec-1" ? [att(1)] : [att(9, "exec-2")],
    );
    const { rerender, ui } = renderSheet(false);
    await screen.findByAltText("foto-1.png");
    rerender(ui(null, false));
    rerender(ui(other, true));
    await screen.findByAltText("foto-9.png");
    expect(downloadAttachment).not.toHaveBeenCalledWith("exec-2", "a-1", expect.anything());
  });
});

describe("ExecutionAttachmentsSheet — nova tentativa do envio (UNIT-003)", () => {
  it("falha de rede lista a foto como Falhou e Tentar novamente reenvia o mesmo File", async () => {
    vi.mocked(listAttachments).mockResolvedValueOnce([]).mockResolvedValueOnce([att(1)]);
    vi.mocked(uploadAttachment)
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(att(1));
    renderSheet(true);
    await screen.findByText("Nenhuma foto anexada.");
    const png = file("nova.png", "image/png");
    fireEvent.change(input(), { target: { files: [png] } });
    expect(await screen.findByText("Falhou")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente nova.png" }));
    expect(await screen.findByAltText("foto-1.png")).toBeInTheDocument();
    expect(uploadAttachment).toHaveBeenCalledTimes(2);
    expect(vi.mocked(uploadAttachment).mock.calls[1][1]).toBe(png);
    expect(screen.queryByText("Falhou")).toBeNull();
  });

  it("5xx também oferece nova tentativa", async () => {
    vi.mocked(listAttachments).mockResolvedValue([]);
    vi.mocked(uploadAttachment).mockRejectedValue(new ApiError(503, "Indisponível", null));
    renderSheet(true);
    await screen.findByText("Nenhuma foto anexada.");
    fireEvent.change(input(), { target: { files: [file("x.png", "image/png")] } });
    expect(
      await screen.findByRole("button", { name: "Tentar novamente x.png" }),
    ).toBeInTheDocument();
  });

  it.each([400, 413])("recusa %i não oferece nova tentativa", async (status) => {
    vi.mocked(listAttachments).mockResolvedValue([]);
    vi.mocked(uploadAttachment).mockRejectedValue(new ApiError(status, "Recusada", null));
    renderSheet(true);
    await screen.findByText("Nenhuma foto anexada.");
    fireEvent.change(input(), { target: { files: [file("x.png", "image/png")] } });
    expect(await screen.findByText("x.png: Recusada")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Tentar novamente x\.png/ })).toBeNull();
  });
});
