import { useEffect, useState, useCallback } from 'react';
import { clearAllCaches, forceUpdate } from '@/lib/pwaUtils';

// Build timestamp injected at build time - changes with each deploy
const BUILD_TIMESTAMP = import.meta.env.VITE_BUILD_TIME || Date.now().toString();

interface VersionState {
  needsUpdate: boolean;
  isChecking: boolean;
  lastChecked: Date | null;
}

/**
 * Hook to detect if app needs update and handle version management
 */
export function useAppVersion() {
  const [state, setState] = useState<VersionState>({
    needsUpdate: false,
    isChecking: false,
    lastChecked: null,
  });

  const checkForUpdate = useCallback(async (): Promise<boolean> => {
    setState(prev => ({ ...prev, isChecking: true }));
    
    try {
      // Check if there's a service worker waiting
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration?.waiting) {
          setState(prev => ({ 
            ...prev, 
            needsUpdate: true, 
            isChecking: false,
            lastChecked: new Date()
          }));
          return true;
        }
        
        // Force update check
        await registration?.update();
        
        // Check again after update
        if (registration?.waiting) {
          setState(prev => ({ 
            ...prev, 
            needsUpdate: true, 
            isChecking: false,
            lastChecked: new Date()
          }));
          return true;
        }
      }
      
      setState(prev => ({ 
        ...prev, 
        needsUpdate: false, 
        isChecking: false,
        lastChecked: new Date()
      }));
      return false;
    } catch (error) {
      console.error('[AppVersion] Error checking for updates:', error);
      setState(prev => ({ 
        ...prev, 
        isChecking: false,
        lastChecked: new Date()
      }));
      return false;
    }
  }, []);

  const performUpdate = useCallback(async () => {
    try {
      await forceUpdate();
    } catch (error) {
      console.error('[AppVersion] Error performing update:', error);
      // Fallback: clear caches and reload
      await clearAllCaches();
      window.location.reload();
    }
  }, []);

  // Check for updates on mount and periodically
  useEffect(() => {
    // Initial check after a short delay
    const initialTimeout = setTimeout(() => {
      checkForUpdate();
    }, 3000);

    // Periodic checks every 5 minutes
    const interval = setInterval(() => {
      checkForUpdate();
    }, 5 * 60 * 1000);

    // Listen for service worker state changes
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // New service worker took control - reload to get fresh content
        if (!state.needsUpdate) {
          window.location.reload();
        }
      });
    }

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [checkForUpdate, state.needsUpdate]);

  return {
    ...state,
    buildTimestamp: BUILD_TIMESTAMP,
    checkForUpdate,
    performUpdate,
  };
}

/**
 * Get the current app version for display
 */
export function getAppVersion(): string {
  return `1.0.${BUILD_TIMESTAMP.slice(-6)}`;
}
