import { defineConfig, configDefaults } from "vitest/config";
import { resolve } from "path";
import { config } from "dotenv";

config({ path: resolve(__dirname, ".env.local") });

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
    exclude: [...configDefaults.exclude],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/db/**", "src/lib/__tests__/**"],
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
