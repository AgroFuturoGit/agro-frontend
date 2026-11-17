export type GeolocationFailure =
  | "denied"
  | "unavailable"
  | "timeout"
  | "unsupported";

export class GeolocationError extends Error {
  reason: GeolocationFailure;

  constructor(reason: GeolocationFailure) {
    super(geolocationErrorMessage(reason));
    this.name = "GeolocationError";
    this.reason = reason;
  }
}

const MESSAGES: Record<GeolocationFailure, string> = {
  denied:
    "Permissão de localização negada. Libere o acesso no navegador ou preencha manualmente.",
  unavailable: "Não foi possível obter a localização. Preencha manualmente.",
  timeout:
    "A localização demorou demais. Tente novamente ou preencha manualmente.",
  unsupported: "Este navegador não oferece localização.",
};

export function geolocationErrorMessage(reason: GeolocationFailure): string {
  return MESSAGES[reason];
}

export function isGeolocationSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.geolocation;
}

const round6 = (v: number) => Math.round(v * 1e6) / 1e6;

export function getCurrentCoordinates(options?: {
  timeoutMs?: number;
}): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (!isGeolocationSupported()) {
      reject(new GeolocationError("unsupported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: round6(position.coords.latitude),
          longitude: round6(position.coords.longitude),
        }),
      (error) => {
        const reason: GeolocationFailure =
          error.code === 1
            ? "denied"
            : error.code === 3
              ? "timeout"
              : "unavailable";
        reject(new GeolocationError(reason));
      },
      {
        enableHighAccuracy: true,
        timeout: options?.timeoutMs ?? 10000,
        maximumAge: 0,
      },
    );
  });
}
