/**
 * Cleanup stale service workers and caches that reference deleted asset chunks.
 *
 * Context: previous deployments registered a service worker at `/sw.js` that no
 * longer exists (returns 404). That phantom SW still serves stale `index.html`
 * pointing to chunks (e.g. RevenueCommandPage-<hash>.js) that were removed on
 * subsequent builds, breaking lazy-loaded routes like /revenue-command.
 *
 * On boot we:
 *  1. Enumerate service worker registrations.
 *  2. Unregister anything that is NOT `/sw-push.js` (the only legitimate SW).
 *  3. Clear caches API entries when a stale SW is removed.
 *
 * Runs once per session (guarded by sessionStorage) to avoid infinite reload.
 */
const GUARD_KEY = "noid_stale_pwa_cleaned_v1";

export async function cleanupStalePwa(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  try {
    if (sessionStorage.getItem(GUARD_KEY) === "1") return;
  } catch {
    // ignore storage errors
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    let removedStale = false;

    for (const reg of registrations) {
      const scriptURL =
        reg.active?.scriptURL ||
        reg.installing?.scriptURL ||
        reg.waiting?.scriptURL ||
        "";
      const isPushSW = scriptURL.endsWith("/sw-push.js");
      if (!isPushSW) {
        try {
          await reg.unregister();
          removedStale = true;
          console.warn("[PWA] Unregistered stale service worker:", scriptURL);
        } catch (err) {
          console.warn("[PWA] Failed to unregister SW", err);
        }
      }
    }

    if (removedStale && "caches" in window) {
      try {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
        console.warn("[PWA] Cleared all caches after stale SW removal");
      } catch (err) {
        console.warn("[PWA] Failed to clear caches", err);
      }

      try {
        sessionStorage.setItem(GUARD_KEY, "1");
      } catch {
        // ignore
      }

      // Reload once so the fresh index.html + current chunks are fetched.
      window.location.reload();
    } else {
      try {
        sessionStorage.setItem(GUARD_KEY, "1");
      } catch {
        // ignore
      }
    }
  } catch (err) {
    console.warn("[PWA] cleanupStalePwa failed", err);
  }
}
