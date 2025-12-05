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

// Register service worker for PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Service worker registration failed, app will work without offline support
    });
  });
}
