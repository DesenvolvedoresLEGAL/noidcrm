import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import "./i18n"; // Initialize i18n

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);

// Register service worker only in production. Avoid importing virtual:pwa-register
// during build:dev because that virtual module requires the PWA plugin build path.
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

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").then((registration) => {
        console.log("[PWA] Service worker registered:", registration.scope);
      if (registration) {
        setInterval(() => {
          registration.update();
        }, 5 * 60 * 1000);
      }
      }).catch((error) => {
        console.log("[PWA] Service worker registration failed:", error);
      });
    });
  }
}
