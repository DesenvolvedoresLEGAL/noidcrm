import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
// Build trigger: remove manualChunks entirely to eliminate TDZ errors
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
    // Aumentar limite de aviso para chunks grandes (vendors)
    chunkSizeWarningLimit: 1500,
    // manualChunks REMOVIDO: causava TDZ "Cannot access 'X' before initialization"
    // por circular dependencies entre chunks vendor. Rollup faz code-splitting
    // automático correto baseado nos dynamic imports (lazy() nas rotas + await import()).
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
        // Do not pre-cache or navigate-fallback to index.html (causes non-precached-url errors)
        navigateFallback: null,
        // Allow large bundles
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        // Não cachear HTML evita mismatch entre index antigo e assets JS novos
        globPatterns: ["**/*.{js,css,ico,png,svg,woff2}"],
        runtimeCaching: [
          // IMPORTANTE: NUNCA cachear chamadas do Supabase (auth, rest, functions, realtime).
          // Cache de /auth/v1/token serve refresh tokens velhos -> 401 + CORS + loop infinito
          // de "Carregando perfil...". Cache de rest/functions mascara stale data.
          // Se quiser cache de leitura, faça no React Query (in-memory), nunca no SW.
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
    // Ensure single React instance across all dependencies
    dedupe: ["react", "react-dom"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    // Pre-bundle React to avoid ESM/CJS interop issues
    include: ["react", "react-dom"],
  },
}));
