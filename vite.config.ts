import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
// Build trigger: remove manualChunks entirely to eliminate TDZ errors
export default defineConfig(async ({ mode, command }) => {
  const devOnlyPlugins: PluginOption[] = [];
  const isCi = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";
  const isLovableEnvironment = Object.keys(process.env).some((key) =>
    key.startsWith("LOVABLE_") || key.startsWith("VITE_LOVABLE_") || key === "LOVABLE_PROJECT_ID"
  );
  const shouldEnablePWA =
    command === "build" &&
    mode === "production" &&
    process.env.VITE_ENABLE_PWA === "true" &&
    !isCi &&
    !isLovableEnvironment;

  if (command === "serve" && mode === "development") {
    const { componentTagger } = await import("lovable-tagger");
    devOnlyPlugins.push(componentTagger());
  }

  const pwaPlugins: PluginOption[] = [];

  if (shouldEnablePWA) {
    const { VitePWA } = await import("vite-plugin-pwa");
    pwaPlugins.push(VitePWA({
      disable: false,
      registerType: "autoUpdate",
      injectRegister: null,
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
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        navigateFallback: null,
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
        ],
      },
    }));
  }

  return {
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
    ...devOnlyPlugins,
    ...pwaPlugins,
  ],
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
  };
});
