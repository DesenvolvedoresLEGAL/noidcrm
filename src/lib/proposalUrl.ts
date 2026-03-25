/**
 * Builds the shareable public URL for a proposal.
 * Uses the Edge Function endpoint so crawlers (WhatsApp, Telegram, etc.)
 * receive dynamic OG meta tags instead of the generic SPA title.
 */
export function buildProposalPublicUrl(token: string): string {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  return `https://${projectId}.supabase.co/functions/v1/og-proposal-meta?token=${token}`;
}
