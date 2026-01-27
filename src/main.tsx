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
  const updateSW = registerSW({
    onNeedRefresh() {
      // New version available - auto-update immediately
      console.log("[PWA] New version available, updating...");
      updateSW(true);
    },
    onOfflineReady() {
      console.log("[PWA] App ready to work offline");
    },
    onRegisteredSW(swUrl, registration) {
      console.log("[PWA] Service worker registered:", swUrl);
      // Check for updates every 5 minutes
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
