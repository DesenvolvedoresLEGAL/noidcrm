import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Inject a deterministic build marker to confirm published version
  define: {
    "import.meta.env.VITE_BUILD_TIME": JSON.stringify(new Date().toISOString()),
  },
  server: {
    host: "::",
    port: 8080,
  },
  build: {
    // Reduz custo/tempo no pipeline e evita trabalho extra durante publish
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        // Reduz quantidade de chunks/arquivos (upload/deploy mais confiável)
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          if (id.includes("react") || id.includes("react-dom") || id.includes("react-router")) {
            return "react";
          }

          if (id.includes("@radix-ui")) return "radix";
          if (id.includes("lucide-react")) return "icons";
          if (id.includes("@tiptap")) return "tiptap";
          if (id.includes("recharts")) return "charts";
          if (id.includes("framer-motion")) return "motion";
          if (id.includes("@supabase")) return "backend";
          if (id.includes("i18next") || id.includes("react-i18next")) return "i18n";
          if (id.includes("date-fns")) return "date";

          return "vendor";
        },
      },
    },
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
        // Force immediate activation of new service worker
        skipWaiting: true,
        clientsClaim: true,
        // Clean old caches on update
        cleanupOutdatedCaches: true,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-cache-v2",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 5, // 5 minutes (reduced from 24 hours)
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
              networkTimeoutSeconds: 10,
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
