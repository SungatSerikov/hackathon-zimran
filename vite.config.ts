import { defineConfig } from "vite";
import { readdirSync } from "node:fs";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __SCENE_ASSETS__: JSON.stringify(
      readdirSync("public/assets", { recursive: true })
        .filter((name) => /\.(png|webp|jpe?g)$/i.test(String(name)))
        .map((name) => `/assets/${String(name).replaceAll("\\", "/")}`),
    ),
  },
  server: { watch: { usePolling: process.env.CASE_DESK_POLL === "1" } },
});
