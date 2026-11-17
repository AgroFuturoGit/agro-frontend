import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GeolocationError,
  getCurrentCoordinates,
  geolocationErrorMessage,
  isGeolocationSupported,
} from "./geolocation";

const original = Object.getOwnPropertyDescriptor(navigator, "geolocation");

function mockGeolocation(value: unknown) {
  Object.defineProperty(navigator, "geolocation", {
    value,
    configurable: true,
  });
}

afterEach(() => {
  if (original) {
    Object.defineProperty(navigator, "geolocation", original);
  } else {
    delete (navigator as unknown as Record<string, unknown>).geolocation;
  }
});

describe("isGeolocationSupported", () => {
  it("retorna true quando navigator.geolocation existe", () => {
    mockGeolocation({ getCurrentPosition: vi.fn() });
    expect(isGeolocationSupported()).toBe(true);
  });

  it("retorna false quando não existe", () => {
    mockGeolocation(undefined);
    expect(isGeolocationSupported()).toBe(false);
  });
});

describe("getCurrentCoordinates", () => {
  it("resolve com valores arredondados para 6 casas", async () => {
    const getCurrentPosition = vi.fn((success: (p: unknown) => void, _e?: unknown, _o?: PositionOptions) =>
      success({ coords: { latitude: -9.123456789, longitude: -35.9876544 } }),
    );
    mockGeolocation({ getCurrentPosition });
    await expect(getCurrentCoordinates()).resolves.toEqual({
      latitude: -9.123457,
      longitude: -35.987654,
    });
  });

  it("usa timeout padrão de 10000 e as opções esperadas", async () => {
    const getCurrentPosition = vi.fn((success: (p: unknown) => void, _e?: unknown, _o?: PositionOptions) =>
      success({ coords: { latitude: 1, longitude: 2 } }),
    );
    mockGeolocation({ getCurrentPosition });
    await getCurrentCoordinates();
    expect(getCurrentPosition.mock.calls[0][2]).toEqual({
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });
  });

  it("aceita timeout customizado", async () => {
    const getCurrentPosition = vi.fn((success: (p: unknown) => void, _e?: unknown, _o?: PositionOptions) =>
      success({ coords: { latitude: 1, longitude: 2 } }),
    );
    mockGeolocation({ getCurrentPosition });
    await getCurrentCoordinates({ timeoutMs: 3000 });
    expect(getCurrentPosition.mock.calls[0][2]?.timeout).toBe(3000);
  });

  it.each([
    [1, "denied"],
    [2, "unavailable"],
    [3, "timeout"],
  ])("mapeia o código %i para %s", async (code, reason) => {
    mockGeolocation({
      getCurrentPosition: (_s: unknown, error: (e: { code: number }) => void) =>
        error({ code }),
    });
    const err = await getCurrentCoordinates().catch((e) => e);
    expect(err).toBeInstanceOf(GeolocationError);
    expect(err.reason).toBe(reason);
    expect(err.message).toBe(geolocationErrorMessage(reason as never));
  });

  it("rejeita com unsupported sem suporte", async () => {
    mockGeolocation(undefined);
    const err = await getCurrentCoordinates().catch((e) => e);
    expect(err).toBeInstanceOf(GeolocationError);
    expect(err.reason).toBe("unsupported");
  });
});
