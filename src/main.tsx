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

const isPreviewHost = () => {
  const { hostname } = window.location;
  return (
    window.self !== window.top ||
    hostname.startsWith("id-preview--") ||
    hostname.startsWith("preview--") ||
    hostname === "lovableproject.com" ||
    hostname.endsWith(".lovableproject.com") ||
    hostname === "lovableproject-dev.com" ||
    hostname.endsWith(".lovableproject-dev.com") ||
    hostname === "beta.lovable.dev" ||
    hostname.endsWith(".beta.lovable.dev")
  );
};

// Register service worker only when PWA was explicitly enabled for production.
if (import.meta.env.PROD && import.meta.env.VITE_ENABLE_PWA === "true" && !isPreviewHost()) {
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
