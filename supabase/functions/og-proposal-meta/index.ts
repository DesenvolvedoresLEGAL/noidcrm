import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CRAWLER_USER_AGENTS = [
  'whatsapp', 'facebookexternalhit', 'facebot', 'telegrambot',
  'twitterbot', 'linkedinbot', 'slackbot', 'discordbot',
  'googlebot', 'bingbot', 'yandexbot', 'baiduspider',
  'embedly', 'showyoubot', 'outbrain', 'pinterestbot',
  'developers.google.com', 'redditbot', 'applebot',
];

function isCrawler(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return CRAWLER_USER_AGENTS.some(bot => ua.includes(bot));
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return new Response('Missing token', { status: 400, headers: corsHeaders });
    }

    const userAgent = req.headers.get('user-agent') || '';
    const appUrl = Deno.env.get('APP_URL') || 'https://noid-crm.lovable.app';
    const spaUrl = `${appUrl}/p/${token}`;

    // For regular browsers, redirect immediately to the SPA
    if (!isCrawler(userAgent)) {
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, 'Location': spaUrl },
      });
    }

    // For crawlers, fetch proposal data and return dynamic OG tags
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: proposal, error } = await supabase
      .from('proposals')
      .select(`
        id, title, public_token, total_amount,
        opportunity:opportunities(title),
        organization:organizations(name, logo_url, primary_color)
      `)
      .eq('public_token', token)
      .single();

    if (error || !proposal) {
      // Fallback: redirect to SPA even for crawlers
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, 'Location': spaUrl },
      });
    }

    const opportunityTitle = (proposal.opportunity as any)?.title;
    const org = proposal.organization as any;
    const orgName = org?.name || '';
    const logoUrl = org?.logo_url || '';
    const primaryColor = org?.primary_color || '#000000';

    const ogTitle = escapeHtml(
      opportunityTitle || proposal.title || 'Proposta Comercial'
    );

    let ogDescription = `Proposta comercial de ${escapeHtml(orgName)}`;
    if (proposal.total_amount) {
      const formatted = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(proposal.total_amount);
      ogDescription += ` - ${formatted}`;
    }

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${ogTitle}</title>
  <meta property="og:type" content="website">
  <meta property="og:title" content="${ogTitle}">
  <meta property="og:description" content="${escapeHtml(ogDescription)}">
  <meta property="og:url" content="${escapeHtml(spaUrl)}">
  ${logoUrl ? `<meta property="og:image" content="${escapeHtml(logoUrl)}">` : ''}
  <meta name="theme-color" content="${escapeHtml(primaryColor)}">
  <meta http-equiv="refresh" content="0;url=${escapeHtml(spaUrl)}">
</head>
<body>
  <p>Redirecionando para a proposta...</p>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (err) {
    console.error('og-proposal-meta error:', err);
    return new Response('Internal error', { status: 500, headers: corsHeaders });
  }
});
