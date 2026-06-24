import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
// Build trigger: remove manualChunks entirely to eliminate TDZ errors
export default defineConfig(async ({ mode, command }) => {
  const devOnlyPlugins: PluginOption[] = [];

  if (command === "serve" && mode === "development") {
    const { componentTagger } = await import("lovable-tagger");
    devOnlyPlugins.push(componentTagger());
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
