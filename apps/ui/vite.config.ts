import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cardScripts } from "./vite-plugin-scripts";
import process from "node:process";
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [react(), cardScripts()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    // YGOProDeck images send no CORS headers; the dev server fetches them for the page.
    proxy: {
      "/ygo-deck": {
        target: "https://ygoprodeck.com",
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/ygo-deck/, "/deck"),
      },
      "/ygo-images": {
        target: "https://images.ygoprodeck.com",
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/ygo-images/, "/images"),
      },
    },
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
