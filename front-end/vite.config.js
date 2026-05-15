import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/upload": "http://localhost:4000",
      "/query": "http://localhost:4000",
    },
  },
});
