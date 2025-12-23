/**
 * Collects browser/client context for audit logging purposes.
 * This helps identify the source of actions for forensic analysis.
 */
export interface AuditContext {
  user_agent: string;
  referrer: string;
  page_url: string;
  screen_resolution: string;
  timezone: string;
  client_timestamp: string;
}

export function collectAuditContext(): AuditContext {
  return {
    user_agent: navigator.userAgent || 'unknown',
    referrer: document.referrer || 'direct',
    page_url: window.location.href,
    screen_resolution: `${window.screen.width}x${window.screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
    client_timestamp: new Date().toISOString(),
  };
}
