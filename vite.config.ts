import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: process.env.BASE_URL || "/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Cuentas Públicas de España en Tiempo Real",
        short_name: "Cuentas Públicas",
        description:
          "Visualiza la deuda pública, el gasto en pensiones y otros indicadores fiscales de España en tiempo real.",
        theme_color: "#1e3a5f",
        background_color: "#0f172a",
        display: "standalone",
        start_url: ".",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,json,png,jpg,svg,ico}"],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("node_modules/react-dom") ||
            id.includes("node_modules/react/") ||
            id.includes("node_modules/scheduler")
          ) {
            return "react-vendor";
          }
          if (
            id.includes("node_modules/recharts") ||
            id.includes("node_modules/d3-")
          ) {
            return "recharts";
          }
          if (id.includes("node_modules/@radix-ui")) {
            return "radix-ui";
          }
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
  },
});
