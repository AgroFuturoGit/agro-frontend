import { afterEach, describe, expect, it, vi } from "vitest";

import { saveBlob } from "@/lib/download";

describe("saveBlob (UNIT-001)", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("clica num link com o nome e libera a URL depois", () => {
    vi.useFakeTimers();
    const create = vi.fn(() => "blob:abc");
    const revoke = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    const blob = new Blob(["x"]);
    saveBlob(blob, "relatorio-teste.pdf");

    expect(create).toHaveBeenCalledWith(blob);
    expect(click).toHaveBeenCalledTimes(1);
    const link = click.mock.contexts[0] as HTMLAnchorElement;
    expect(link.download).toBe("relatorio-teste.pdf");
    expect(link.href).toBe("blob:abc");
    expect(document.querySelector("a[download]")).toBeNull();
    expect(revoke).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith("blob:abc");
  });
});
