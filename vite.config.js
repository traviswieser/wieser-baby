import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// VITE_BASE_PATH is set to /wieser-baby/ by the GitHub Pages workflow.
// Netlify leaves it unset so it defaults to /, which is correct there.
const base = process.env.VITE_BASE_PATH || "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      cacheId: "wieser-baby-v272",
      base,
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "icon-192.png", "icon-512.png", "icon-1024.png"],
      manifest: {
        name: "Wieser Baby",
        short_name: "Wieser Baby",
        description: "Baby & toddler tracking — feeding, sleep, diapers, milestones and more",
        theme_color: "#07080d",
        background_color: "#07080d",
        display: "standalone",
        orientation: "portrait",
        start_url: base,
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: { cacheName: "google-fonts-cache", expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            urlPattern: /^https:\/\/world\.openfoodfacts\.org\/.*/i,
            handler: "NetworkFirst",
            options: { cacheName: "openfoodfacts-cache", expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 } },
          },
        ],
      },
    }),
  ],
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        manualChunks: {
          vendor:   ["react", "react-dom"],
          charts:   ["recharts"],
          firebase: ["firebase/app", "firebase/firestore", "firebase/auth"],
        },
      },
    },
  },
});
