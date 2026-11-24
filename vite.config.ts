import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

export default defineConfig(({ mode, command }) => {
  // Server functions need local .env values too. Only VITE_* is exposed by Vite.
  const env = loadEnv(mode, process.cwd(), "");
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
  return {
    plugins: [
      tailwindcss(),
      tsconfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({ server: { entry: "server" } }),
      ...(command === "build" ? [nitro({ preset: "node-server" })] : []),
      react(),
    ],
    resolve: { dedupe: ["react", "react-dom", "@tanstack/react-router"] },
   
    server: {
      port: 8080,
      strictPort: true,
      proxy: { "/api": { target: env["BACKEND_URL"] || "http://127.0.0.1:3001" } },
    },
  };
});
