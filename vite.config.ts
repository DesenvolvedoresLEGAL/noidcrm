import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
// Build trigger: refresh manual chunks + SW navigateFallback fix
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
    rollupOptions: {
      output: {
        // Code splitting agressivo por vendor para minimizar bundle inicial.
        // Estratégia: dividir libs grandes em chunks separados, cacheáveis
        // independentemente. Permite que `lazy()` em rotas funcione de fato
        // e que libs como xlsx/jspdf só carreguem sob demanda.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;

          // CRÍTICO: React + Radix + libs que dependem de React internals (forwardRef,
          // hooks, jsx-runtime) devem ficar JUNTOS no mesmo chunk. Separar Radix
          // do React quebra forwardRef em runtime (chunks carregam fora de ordem).
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/react/jsx-runtime') ||
            id.includes('/scheduler/') ||
            id.includes('@radix-ui') ||
            id.includes('react-remove-scroll') ||
            id.includes('react-style-singleton') ||
            id.includes('use-callback-ref') ||
            id.includes('use-sidecar') ||
            id.includes('aria-hidden') ||
            id.includes('@floating-ui')
          ) {
            return 'react-vendor';
          }
          // Charts (carregadas em dashboards)
          if (id.includes('recharts') || id.includes('d3-')) return 'charts-vendor';
          // Editor rich text
          if (id.includes('@tiptap') || id.includes('prosemirror')) return 'editor-vendor';
          // PDF/Excel libs (devem ser carregadas sob demanda via dynamic import)
          if (id.includes('jspdf') || id.includes('xlsx') || id.includes('papaparse')) {
            return 'pdf-excel-vendor';
          }
          // Animation
          if (id.includes('framer-motion')) return 'motion-vendor';
          // Tudo o resto vai para vendor único — evita chunks com dependências cruzadas
          return 'vendor';
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
        // Do not pre-cache or navigate-fallback to index.html (causes non-precached-url errors)
        navigateFallback: null,
        // Allow large bundles
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        // Não cachear HTML evita mismatch entre index antigo e assets JS novos
        globPatterns: ["**/*.{js,css,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-cache-v2",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 5, // 5 minutes
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
