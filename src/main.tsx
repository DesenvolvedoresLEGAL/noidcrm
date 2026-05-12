import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";
import "./i18n"; // Initialize i18n

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);

// Register service worker for PWA using vite-plugin-pwa's unified approach
// This replaces manual navigator.serviceWorker.register to avoid duplicate SW conflicts
if (import.meta.env.PROD) {
  // One-time cleanup: deleta caches antigos do SW que continham respostas Supabase
  // (refresh tokens velhos cacheados causavam 401 + loop infinito de "Carregando perfil...").
  if ("caches" in window) {
    caches.keys().then((keys) => {
      keys
        .filter((k) => k.includes("supabase-cache") || k.includes("supabase"))
        .forEach((k) => caches.delete(k));
    }).catch(() => {});
  }

  const updateSW = registerSW({
    onNeedRefresh() {
      console.log("[PWA] New version available, updating...");
      updateSW(true);
    },
    onOfflineReady() {
      console.log("[PWA] App ready to work offline");
    },
    onRegisteredSW(swUrl, registration) {
      console.log("[PWA] Service worker registered:", swUrl);
      if (registration) {
        setInterval(() => {
          registration.update();
        }, 5 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.log("[PWA] Service worker registration failed:", error);
    },
  });
}
