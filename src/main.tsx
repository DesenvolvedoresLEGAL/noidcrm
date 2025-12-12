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

// Register service worker for PWA with auto-update support
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      
      // Check for updates immediately
      registration.update();
      
      // Check for updates every 5 minutes
      setInterval(() => {
        registration.update();
      }, 5 * 60 * 1000);
      
      // Handle new service worker waiting
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              // New version available - skip waiting immediately
              newWorker.postMessage({ type: "SKIP_WAITING" });
              console.log("[PWA] New version available, activating...");
            }
          });
        }
      });
      
      // Listen for controller change and reload
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!refreshing) {
          refreshing = true;
          console.log("[PWA] New version activated, reloading...");
          window.location.reload();
        }
      });
      
    } catch (error) {
      console.log("[PWA] Service worker registration failed:", error);
    }
  });
}
