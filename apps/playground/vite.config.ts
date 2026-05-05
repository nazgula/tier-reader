import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { decomposeApiPlugin } from "./server/decompose-route.js";

export default defineConfig({
  plugins: [react(), decomposeApiPlugin()],
  server: {
    port: 5174,
    strictPort: true,
  },
});
