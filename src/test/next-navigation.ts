import { vi } from "vitest";

/**
 * Mock global de `next/navigation`.
 *
 * Antes existia um `vi.mock("next/navigation", ...)` ad-hoc em cada arquivo de
 * teste que renderizava componente com <Link>, useRouter ou usePathname. Além
 * da duplicação, cada cópia expunha só a parte do módulo que aquele teste
 * usava, então adicionar um `useSearchParams` no componente quebrava o teste
 * com "não é uma função" em vez de falhar pelo comportamento.
 *
 * Uso no arquivo de teste:
 *
 *     vi.mock("next/navigation", async () => {
 *       const { navigationMockModule } = await import("@/test/next-navigation");
 *       return navigationMockModule;
 *     });
 *
 * O import dentro da factory é obrigatório: `vi.mock` é içado para o topo do
 * arquivo, acima dos imports estáticos.
 */

const push = vi.fn();
const replace = vi.fn();
const refresh = vi.fn();
const back = vi.fn();
const forward = vi.fn();
const prefetch = vi.fn();

/**
 * Referência ESTÁVEL entre renders — o `useRouter()` real do Next.js devolve o
 * mesmo objeto a cada render. Devolver um literal novo por chamada quebraria a
 * identidade de callbacks que dependem de `router` e faria efeitos de busca
 * dispararem de novo a cada render, mascarando bugs reais de "buscou mais de
 * uma vez" atrás de um artefato do mock.
 */
export const router = { push, replace, refresh, back, forward, prefetch };

let pathname = "/admin";
let searchParams = new URLSearchParams();
let params: Record<string, string> = {};

/** Ajusta o retorno de `usePathname()` para o teste corrente. */
export function setPathname(value: string) {
  pathname = value;
}

/** Ajusta o retorno de `useSearchParams()` para o teste corrente. */
export function setSearchParams(init: string | Record<string, string>) {
  searchParams = new URLSearchParams(init);
}

/** Ajusta o retorno de `useParams()` para o teste corrente. */
export function setParams(value: Record<string, string>) {
  params = value;
}

/** Zera spies e valores de rota. Chame no `afterEach` do arquivo de teste. */
export function resetNavigationMock() {
  for (const spy of Object.values(router)) spy.mockReset();
  pathname = "/admin";
  searchParams = new URLSearchParams();
  params = {};
}

/** O objeto devolvido pela factory do `vi.mock`. */
export const navigationMockModule = {
  useRouter: () => router,
  usePathname: () => pathname,
  useSearchParams: () => searchParams,
  useParams: () => params,
};
