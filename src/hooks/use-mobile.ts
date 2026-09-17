import * as React from "react"

const MOBILE_BREAKPOINT = 768
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

// `window.matchMedia` pode não existir em ambientes de teste que não o
// polyfillam (jsdom não o implementa por padrão) — sem essa guarda, todo
// consumidor de `useIsMobile` quebraria nesses ambientes, mesmo sem nunca
// ter testado o hook diretamente. Trata como "não é mobile", igual ao
// `getServerSnapshot` já faz para SSR.
function hasMatchMedia() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
}

function subscribe(callback: () => void) {
  if (!hasMatchMedia()) return () => {}
  const mql = window.matchMedia(MOBILE_QUERY)
  mql.addEventListener("change", callback)
  return () => mql.removeEventListener("change", callback)
}

function getSnapshot() {
  if (!hasMatchMedia()) return false
  return window.matchMedia(MOBILE_QUERY).matches
}

function getServerSnapshot() {
  return false
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
