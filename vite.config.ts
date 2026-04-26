import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.ico",
        "favicon.svg",
        "icons/apple-touch-icon-180x180.png",
        "icons/maskable-icon-512x512.png",
        "icons/pwa-64x64.png",
        "icons/pwa-192x192.png",
        "icons/pwa-512x512.png",
        "fonts/Orbitron-VariableFont_wght.ttf"
      ],
      manifest: {
        name: "Starfall Aegis",
        short_name: "Starfall",
        description: "Touch-first Phaser space shooter with local practice and online-ready ranked flow.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "any",
        background_color: "#030712",
        theme_color: "#030712",
        icons: [
          {
            src: "/icons/pwa-64x64.png",
            sizes: "64x64",
            type: "image/png"
          },
          {
            src: "/icons/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "/icons/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png"
          },
          {
            src: "/icons/maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,ttf,wav}"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/phaser")) {
            return "phaser";
          }
        }
      }
    }
  },
  server: {
    host: "0.0.0.0",
    port: 5173
  },
  preview: {
    host: "0.0.0.0",
    port: 4173
  }
});
