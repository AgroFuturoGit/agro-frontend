import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ExportMenu } from "@/components/admin/dashboard/export-menu";
import { ApiError } from "@/lib/api";
import { saveBlob } from "@/lib/download";

vi.mock("@/lib/download", () => ({ saveBlob: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function openMenu() {
  const trigger = screen.getByRole("button", { name: "Exportar relatório" });
  trigger.focus();
  // Enter/Espaço num botão nativo disparam `click`; o jsdom não faz essa ponte.
  fireEvent.click(trigger);
  return trigger;
}

async function choose(name: string) {
  const item = await screen.findByRole("menuitem", { name });
  fireEvent.click(item);
}

const file = { blob: new Blob(["x"]), filename: "relatorio-x.pdf" };

describe("ExportMenu (UNIT-003)", () => {
  it("oferece PDF e Excel e salva o arquivo com o nome do back", async () => {
    const onExport = vi.fn(async () => file);
    render(<ExportMenu onExport={onExport} />);
    await openMenu();
    expect(await screen.findByRole("menuitem", { name: "PDF" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Excel (.xlsx)" })).toBeTruthy();

    await choose("Excel (.xlsx)");

    await waitFor(() => expect(saveBlob).toHaveBeenCalledWith(file.blob, "relatorio-x.pdf"));
    expect(onExport).toHaveBeenCalledWith("xlsx");
  });

  it("fica desabilitado enquanto o painel carrega", () => {
    render(<ExportMenu onExport={vi.fn()} disabled />);
    const trigger = screen.getByRole("button", { name: "Exportar relatório" });
    expect((trigger as HTMLButtonElement).disabled || trigger.hasAttribute("data-disabled")).toBe(true);
  });

  it("durante a geração mostra carregamento, aria-busy e ignora outro disparo", async () => {
    let finish: (v: typeof file) => void = () => {};
    const onExport = vi.fn(
      () => new Promise<typeof file>((resolve) => (finish = resolve)),
    );
    render(<ExportMenu onExport={onExport} />);
    await openMenu();
    await choose("PDF");

    const trigger = await screen.findByRole("button", { name: "Exportar relatório" });
    await waitFor(() => expect(trigger.getAttribute("aria-busy")).toBe("true"));
    expect(screen.getByText("Gerando…")).toBeTruthy();
    fireEvent.click(trigger);
    expect(onExport).toHaveBeenCalledTimes(1);

    await act(async () => finish(file));
    await waitFor(() => expect(trigger.getAttribute("aria-busy")).toBe("false"));
    expect(screen.getByText("Exportar")).toBeTruthy();
  });

  it("mostra a mensagem do back e some no próximo clique", async () => {
    const onExport = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(403, "Acesso negado ao relatório", null))
      .mockResolvedValueOnce(file);
    render(<ExportMenu onExport={onExport} />);
    await openMenu();
    await choose("PDF");
    expect((await screen.findByRole("alert")).textContent).toContain("Acesso negado ao relatório");
    expect(saveBlob).not.toHaveBeenCalled();

    await openMenu();
    await choose("PDF");
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(saveBlob).toHaveBeenCalledTimes(1);
  });

  it("erro sem mensagem do back usa o texto padrão", async () => {
    render(<ExportMenu onExport={vi.fn().mockRejectedValue(new TypeError("net"))} />);
    await openMenu();
    await choose("PDF");
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Não foi possível gerar o relatório.",
    );
  });

  it("abre pelo teclado e as opções navegam com setas", async () => {
    render(<ExportMenu onExport={vi.fn(async () => file)} />);
    await openMenu();
    const pdf = await screen.findByRole("menuitem", { name: "PDF" });
    const excel = screen.getByRole("menuitem", { name: "Excel (.xlsx)" });
    await waitFor(() => expect(document.activeElement).toBe(pdf));
    fireEvent.keyDown(pdf, { key: "ArrowDown" });
    await waitFor(() => expect(document.activeElement).toBe(excel));
  });
});
