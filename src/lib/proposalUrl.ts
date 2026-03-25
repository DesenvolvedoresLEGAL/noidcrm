/**
 * Builds the shareable public URL for a proposal.
 * Uses the Edge Function endpoint so crawlers (WhatsApp, Telegram, etc.)
 * receive dynamic OG meta tags instead of the generic SPA title.
 */
export function buildProposalPublicUrl(token: string): string {
  const backendUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${backendUrl}/functions/v1/og-proposal-meta?token=${encodeURIComponent(token)}`;
}

/**
 * Builds the direct SPA URL for opening a proposal in the browser.
 * Use this for window.open / navigation; use buildProposalPublicUrl for sharing.
 */
export function buildProposalDirectUrl(token: string): string {
  return `${window.location.origin}/p/${token}`;
}
