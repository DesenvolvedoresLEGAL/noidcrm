// PWA Utilities for cache management and updates

export const APP_VERSION = '1.0.' + Date.now().toString().slice(-6);

/**
 * Clear all service worker caches
 */
export async function clearAllCaches(): Promise<boolean> {
  try {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
      console.log('[PWA] All caches cleared');
      return true;
    }
    return false;
  } catch (error) {
    console.error('[PWA] Error clearing caches:', error);
    return false;
  }
}

/**
 * Force update the service worker and reload
 */
export async function forceUpdate(): Promise<void> {
  try {
    // Clear all caches
    await clearAllCaches();
    
    // Unregister all service workers
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map(registration => registration.unregister())
      );
      console.log('[PWA] Service workers unregistered');
    }
    
    // AUTH.1.2: NUNCA tocar em chaves do Supabase Auth (sb-* / supabase-*).
    // Removemos apenas marcadores próprios de versão de app/cache.
    try {
      const SAFE_KEYS = ['app_version', 'cache_timestamp'];
      for (const key of SAFE_KEYS) {
        if (key.startsWith('sb-') || key.includes('supabase')) continue;
        localStorage.removeItem(key);
      }
    } catch {
      // Ignore localStorage errors
    }
    
    // Add cache-busting parameter to force fresh load
    const url = new URL(window.location.href);
    url.searchParams.set('_refresh', Date.now().toString());
    
    // Use replace to avoid back button issues
    window.location.replace(url.toString());
  } catch (error) {
    console.error('[PWA] Error forcing update:', error);
    // Still try to reload with cache busting
    window.location.href = window.location.href + '?_refresh=' + Date.now();
  }
}

/**
 * Check if a new version is available
 */
export async function checkForUpdates(): Promise<boolean> {
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.update();
        return registration.waiting !== null;
      }
    }
    return false;
  } catch (error) {
    console.error('[PWA] Error checking for updates:', error);
    return false;
  }
}

/**
 * Skip waiting and activate new service worker
 */
export async function skipWaitingAndReload(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration?.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    }
    // Give the SW time to activate, then reload
    setTimeout(() => window.location.reload(), 100);
  } catch (error) {
    console.error('[PWA] Error skipping wait:', error);
    window.location.reload();
  }
}
