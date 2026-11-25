import { fileURLToPath, URL } from "node:url";
import { defineConfig, version } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { assertPatchedVite } from "./scripts/check-vite-version.mjs";

export default defineConfig(({ command }) => {
  if (command === "serve") assertPatchedVite(version);
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
    build: { sourcemap: false },
    server: {
      host: "127.0.0.1",
      port: Number(process.env.PORT || 5173),
      strictPort: true,
      // API_URL lets a second local copy point at another API port.
      proxy: { "/api": process.env.API_URL || "http://127.0.0.1:3001" },
    },
    preview: { host: "127.0.0.1", port: 4173, strictPort: true },
  };
});
