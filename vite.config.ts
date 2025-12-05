import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico"],
      manifest: {
        name: "NOID CRM",
        short_name: "NOID",
        description: "AI Revenue Operating System - CRM inteligente para equipes de vendas",
        theme_color: "#6366f1",
        background_color: "#0a0a0a",
        display: "standalone",
        start_url: "/app/dashboard",
        icons: [
          {
            src: "https://storage.googleapis.com/gpt-engineer-file-uploads/kzr3My2Jj6WjfkujhF67VcMx3qq1/uploads/1761596670754-ALUGUE - icone.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "https://storage.googleapis.com/gpt-engineer-file-uploads/kzr3My2Jj6WjfkujhF67VcMx3qq1/uploads/1761596670754-ALUGUE - icone.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
