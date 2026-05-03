// Chunk Error Recovery - Detects and recovers from PWA/cache loading failures

import { forceUpdate } from './pwaUtils';

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
 * AUTH.1.2: NÃO recarrega a página automaticamente. Apenas registra a
 * tentativa, emite um evento global `noid:chunk-error` e devolve `false`.
 * A UI (ErrorBoundary, banners) decide se/quando oferecer reload manual.
 */
export async function attemptChunkRecovery(): Promise<boolean> {
  const attempts = incrementRecoveryAttempts();

  console.warn(`[ChunkRecovery] Detected (attempt ${attempts}/${RECOVERY_MAX_ATTEMPTS}) — no auto reload`);

  try {
    window.dispatchEvent(
      new CustomEvent('noid:chunk-error', {
        detail: { attempts, max: RECOVERY_MAX_ATTEMPTS, reason: 'chunk_load_failed' },
      }),
    );
  } catch {
    // ignore
  }

  return false;
}

/**
 * Force a hard reset - clear everything and reload (manual user action only)
 */
export async function forceHardReset(): Promise<void> {
  console.log('[ChunkRecovery] User requested hard reset');
  // Clear the recovery counter so user can try again fresh
  clearRecoveryAttempts();
  await forceUpdate();
}

/**
 * Setup global error handlers for catching chunk load errors
 * outside of React error boundaries.
 *
 * AUTH.1.2: NUNCA chama reload automático. Apenas loga e dispara evento.
 */
export function setupGlobalChunkErrorHandlers(): void {
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason;
    if (error instanceof Error && isChunkLoadError(error)) {
      console.warn('[ChunkRecovery] unhandled chunk rejection (no auto reload):', error.message);
      event.preventDefault();
      try {
        window.dispatchEvent(
          new CustomEvent('noid:chunk-error', { detail: { reason: 'unhandledrejection' } }),
        );
      } catch {
        // ignore
      }
    }
  });

  window.addEventListener('error', (event) => {
    const error = event.error;
    if (error instanceof Error && isChunkLoadError(error)) {
      console.warn('[ChunkRecovery] global chunk error (no auto reload):', error.message);
      event.preventDefault();
      try {
        window.dispatchEvent(
          new CustomEvent('noid:chunk-error', { detail: { reason: 'window_error' } }),
        );
      } catch {
        // ignore
      }
    }
  });

  console.log('[ChunkRecovery] Global handlers installed (no auto reload)');
}
