import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearAppCaches,
  clearSession,
  getUserSnapshot,
  persistSession,
  refreshSessionFromServer,
  subscribeUserStorage,
} from "@/lib/auth";

// O Node recente expõe um `localStorage` global próprio que sobrepõe o do jsdom
// (indefinido sem --localstorage-file): troca por um armazenamento em memória.
function installMemoryStorage() {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  });
}

const user = {
  id: "u1",
  fullName: "Maria",
  email: "m@x.com",
  cpf: "123",
  role: "FARMER" as const,
  dateOfBirth: "1990-01-01",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  installMemoryStorage();
  clearSession();
  persistSession({ token: "tok", userResponseDTO: user });
});

afterEach(() => {
  clearSession();
  vi.unstubAllGlobals();
});

describe("refreshSessionFromServer (UNIT-004)", () => {
  it("regrava cookie de papel e agro_user com o retorno do /auth/me", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ ...user, role: "MANAGER", dateOfBirth: undefined }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await refreshSessionFromServer();

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/auth\/me$/);
    expect(result?.role).toBe("MANAGER");
    expect(document.cookie).toContain("agro_role=MANAGER");
    expect(getUserSnapshot()?.role).toBe("MANAGER");
    expect(getUserSnapshot()?.dateOfBirth).toBe("1990-01-01");
  });

  it("não regrava a sessão se o logout ocorreu durante a requisição", async () => {
    let resolveFetch!: (r: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(new Promise<Response>((r) => (resolveFetch = r))),
    );

    const pending = refreshSessionFromServer();
    clearSession();
    resolveFetch(jsonResponse(user));

    expect(await pending).toBeNull();
    expect(document.cookie).not.toContain("agro_token=");
    expect(getUserSnapshot()).toBeNull();
  });

  it("com localStorage limpo, o usuário volta quando o /auth/me responde", async () => {
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(user)));
    const listener = vi.fn();
    const unsubscribe = subscribeUserStorage(listener);

    await refreshSessionFromServer();
    unsubscribe();

    expect(getUserSnapshot()?.fullName).toBe("Maria");
    expect(listener).toHaveBeenCalled();
  });

  it("ignora falha HTTP ou de rede sem mexer na sessão", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 500)));
    expect(await refreshSessionFromServer()).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("net")));
    expect(await refreshSessionFromServer()).toBeNull();
    expect(document.cookie).toContain("agro_token=tok");
    expect(getUserSnapshot()?.role).toBe("FARMER");
  });
});

describe("clearAppCaches (UNIT-005)", () => {
  it("apaga os caches de dados e preserva o precache e os assets", async () => {
    const del = vi.fn().mockResolvedValue(true);
    vi.stubGlobal("caches", {
      keys: vi.fn().mockResolvedValue([
        "serwist-precache-v2-https://x/",
        "static-image-assets",
        "cross-origin",
        "pages",
        "next-data",
      ]),
      delete: del,
    });

    await clearAppCaches();

    expect(del).toHaveBeenCalledWith("cross-origin");
    expect(del).toHaveBeenCalledWith("pages");
    expect(del).toHaveBeenCalledWith("next-data");
    expect(del).not.toHaveBeenCalledWith("serwist-precache-v2-https://x/");
    expect(del).not.toHaveBeenCalledWith("static-image-assets");
  });

  it("não falha sem Cache Storage", async () => {
    vi.stubGlobal("caches", undefined);
    await expect(clearAppCaches()).resolves.toBeUndefined();
  });
});
