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

          // React core — sempre necessário, isolado para cache estável
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) {
            return 'react-vendor';
          }
          // Router
          if (id.includes('react-router')) return 'router-vendor';
          // React Query
          if (id.includes('@tanstack/react-query')) return 'query-vendor';
          // Supabase SDK
          if (id.includes('@supabase')) return 'supabase-vendor';
          // Radix UI (muitos componentes pequenos — agrupar)
          if (id.includes('@radix-ui')) return 'radix-vendor';
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
          // Date utilities
          if (id.includes('date-fns')) return 'date-vendor';
          // Icons
          if (id.includes('lucide-react')) return 'icons-vendor';
          // Form libs
          if (id.includes('react-hook-form') || id.includes('@hookform') || id.includes('zod')) {
            return 'form-vendor';
          }
          // Tudo que sobrar de node_modules vai para um chunk único de vendor
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
        // Allow large single bundle (up to 10 MiB) since we disabled code splitting
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        // Não cachear HTML (index.html) evita mismatch entre index antigo e assets JS novos
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
