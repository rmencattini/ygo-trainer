import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "node",
          environment: "node",
          include: ["scripts/**/*.test.{ts,mjs}", "packages/**/*.test.ts"],
        },
      },
      {
        plugins: [react()],
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["apps/ui/**/*.test.{ts,tsx}"],
          setupFiles: ["apps/ui/src/test-setup.ts"],
        },
      },
    ],
  },
});
