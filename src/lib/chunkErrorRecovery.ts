// Chunk Error Recovery - Detects and recovers from PWA/cache loading failures

import { forceUpdate, skipWaitingAndReload, clearAllCaches } from './pwaUtils';

const CHUNK_ERROR_PATTERNS = [
  'Failed to fetch dynamically imported module',
  'Loading chunk',
  'Importing a module script failed',
  'error loading dynamically imported module',
  'Failed to load module script',
  'ChunkLoadError',
  'Loading CSS chunk',
  'Unable to preload CSS',
  'NetworkError when attempting to fetch resource',
  'Failed to fetch',
  'dynamically imported module',
  'Unexpected token',
  '<!doctype',
  '<!DOCTYPE',
  'expected expression, got',
  'mime type',
  "Cannot use import statement outside a module",
];

const RECOVERY_KEY = 'chunk_recovery_attempt';
const RECOVERY_MAX_ATTEMPTS = 3;

/**
 * Check if an error is related to chunk/module loading
 */
export function isChunkLoadError(error: Error | null | undefined): boolean {
  if (!error) return false;
  
  const message = error.message?.toLowerCase() || '';
  const name = error.name?.toLowerCase() || '';
  
  return CHUNK_ERROR_PATTERNS.some(pattern => 
    message.includes(pattern.toLowerCase()) || name.includes(pattern.toLowerCase())
  );
}

/**
 * Get current recovery attempt count
 */
function getRecoveryAttempts(): number {
  try {
    const stored = sessionStorage.getItem(RECOVERY_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      // Reset if older than 2 minutes (the error loop should be quick)
      if (Date.now() - data.timestamp > 2 * 60 * 1000) {
        sessionStorage.removeItem(RECOVERY_KEY);
        return 0;
      }
      return data.attempts || 0;
    }
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Increment recovery attempt counter
 */
function incrementRecoveryAttempts(): number {
  try {
    const attempts = getRecoveryAttempts() + 1;
    sessionStorage.setItem(RECOVERY_KEY, JSON.stringify({
      attempts,
      timestamp: Date.now()
    }));
    return attempts;
  } catch {
    return 1;
  }
}

/**
 * Clear recovery attempts (call after successful load)
 */
export function clearRecoveryAttempts(): void {
  try {
    sessionStorage.removeItem(RECOVERY_KEY);
  } catch {
    // Ignore
  }
}

/**
 * Attempt automatic recovery from chunk load error
 * Returns true if recovery was attempted (page will reload)
 */
export async function attemptChunkRecovery(): Promise<boolean> {
  const attempts = incrementRecoveryAttempts();
  
  console.log(`[ChunkRecovery] Attempt ${attempts}/${RECOVERY_MAX_ATTEMPTS}`);
  
  if (attempts === 1) {
    // First attempt: soft recovery - skip waiting and reload
    console.log('[ChunkRecovery] Trying soft recovery (skipWaitingAndReload)');
    await skipWaitingAndReload();
    return true;
  } else if (attempts === 2) {
    // Second attempt: clear caches and reload
    console.log('[ChunkRecovery] Trying cache clear recovery');
    await clearAllCaches();
    await new Promise(resolve => setTimeout(resolve, 200));
    window.location.reload();
    return true;
  } else if (attempts <= RECOVERY_MAX_ATTEMPTS) {
    // Third attempt: hard recovery - unregister SW and clear all
    console.log('[ChunkRecovery] Trying hard recovery (forceUpdate)');
    await forceUpdate();
    return true;
  }
  
  // Max attempts reached - don't auto-recover, let user see the error
  console.log('[ChunkRecovery] Max attempts reached, showing error to user');
  return false;
}

/**
 * Force a hard reset - clear everything and reload
 */
export async function forceHardReset(): Promise<void> {
  console.log('[ChunkRecovery] User requested hard reset');
  // Clear the recovery counter so user can try again fresh
  clearRecoveryAttempts();
  await forceUpdate();
}

/**
 * Setup global error handlers for catching chunk load errors
 * outside of React error boundaries
 */
export function setupGlobalChunkErrorHandlers(): void {
  // Handle unhandled promise rejections (dynamic imports fail as rejections)
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason;
    if (error instanceof Error && isChunkLoadError(error)) {
      console.error('[ChunkRecovery] Caught unhandled chunk load rejection:', error.message);
      event.preventDefault();
      attemptChunkRecovery();
    }
  });

  // Handle regular errors (backup)
  window.addEventListener('error', (event) => {
    const error = event.error;
    if (error instanceof Error && isChunkLoadError(error)) {
      console.error('[ChunkRecovery] Caught global chunk load error:', error.message);
      event.preventDefault();
      attemptChunkRecovery();
    }
  });

  console.log('[ChunkRecovery] Global handlers installed');
}
