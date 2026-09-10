import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    // e2e/ é a suíte do Playwright (npm run test:e2e), não do Vitest —
    // sem essa exclusão, o padrão default de include do Vitest também
    // tenta carregar e2e/*.spec.ts e falha (test() do Playwright chamado
    // fora do runner do Playwright).
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});
