import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

// https://vitejs.dev/config/
export default defineConfig({
  root: resolve(__dirname),
  plugins: [vue()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8081",
        changeOrigin: true,
      },
      "/badge": {
        target: "http://localhost:8081",
        changeOrigin: true,
      },
      "/swagger": {
        target: "http://localhost:8081",
        changeOrigin: true,
      },
      "/docs": {
        target: "http://localhost:5174",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: resolve(__dirname, "../../dist"),
    emptyOutDir: true,
    minify: "terser",
    sourcemap: false,
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
});
