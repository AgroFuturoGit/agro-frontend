import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: WorkerGlobalScope;

// O worker não tem `process.env` (o Serwist o compila à parte, sem o DefinePlugin
// do Next), então a origem da API não é lida de variável: toda requisição para
// outra origem, ou com `Authorization`, vai direto à rede. Exceção: fontes do
// Google, que seguem no cache do `defaultCache`. Efeito colateral aceito: outros
// assets de origem externa também deixam de ser cacheados.
const CACHEABLE_EXTERNAL_HOSTS = ["fonts.gstatic.com", "fonts.googleapis.com"];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Respostas autenticadas ou da API nunca ficam no cache (antes do defaultCache).
    {
      matcher: ({ request, sameOrigin, url }) =>
        request.headers.has("Authorization") ||
        (!sameOrigin && !CACHEABLE_EXTERNAL_HOSTS.includes(url.hostname)),
      handler: new NetworkOnly(),
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();
