import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { decomposeApiPlugin } from "./server/decompose-route.js";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  for (const k of ["ANTHROPIC_API_KEY", "LANGFUSE_PUBLIC_KEY", "LANGFUSE_SECRET_KEY"]) {
    if (env[k] && !process.env[k]) process.env[k] = env[k];
  }
  return {
    plugins: [react(), decomposeApiPlugin()],
    server: {
      port: 5174,
      strictPort: true,
    },
  };
});
