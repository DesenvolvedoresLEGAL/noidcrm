import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import "./i18n"; // Initialize i18n
import { cleanupStalePwa } from "./lib/cleanupStalePwa";

// Remove any phantom service workers (e.g. old /sw.js) that keep serving stale
// index.html referencing deleted chunks like RevenueCommandPage-<hash>.js.
// Runs before rendering so a one-time reload happens on a clean slate.
void cleanupStalePwa();

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
