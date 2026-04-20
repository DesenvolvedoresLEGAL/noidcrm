import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface GmailMessage {
  id: string;
  threadId: string;
}

interface GmailMessageDetail {
  id: string;
  threadId: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: Array<{
      mimeType: string;
      body?: { data?: string };
      parts?: Array<{ mimeType: string; body?: { data?: string } }>;
    }>;
  };
  internalDate: string;
}

function getHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
}

function extractEmailAddress(headerValue: string): string {
  const match = headerValue.match(/<([^>]+)>/);
  return match ? match[1] : headerValue.trim();
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  const decoded = atob(base64);
  return new TextDecoder().decode(
    Uint8Array.from(decoded, c => c.charCodeAt(0))
  );
}

function extractBody(payload: GmailMessageDetail['payload']): string {
  // Try direct body
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  // Try parts
  if (payload.parts) {
    // Prefer text/html
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
      // Check nested parts (multipart/alternative inside multipart/mixed)
      if (part.parts) {
        for (const subpart of part.parts) {
          if (subpart.mimeType === 'text/html' && subpart.body?.data) {
            return decodeBase64Url(subpart.body.data);
          }
        }
      }
    }
    // Fallback to text/plain
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return `<pre>${decodeBase64Url(part.body.data)}</pre>`;
      }
      if (part.parts) {
        for (const subpart of part.parts) {
          if (subpart.mimeType === 'text/plain' && subpart.body?.data) {
            return `<pre>${decodeBase64Url(subpart.body.data)}</pre>`;
          }
        }
      }
    }
  }

  return '';
}

async function refreshAccessToken(
  supabaseAdmin: any,
  syncConfig: any
): Promise<string> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured');
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: syncConfig.refresh_token_encrypted,
      grant_type: 'refresh_token',
    }),
  });

  const tokenData = await tokenResponse.json();

  if (!tokenData.access_token) {
    // Detect revoked / expired refresh token (Google returns invalid_grant)
    const isRevoked = tokenData.error === 'invalid_grant';
    if (isRevoked) {
      console.warn('[sync-email-replies] Refresh token revoked/expired for config', syncConfig.id, '— disabling sync.');
      // Mark config as disconnected so UI prompts reconnect
      await supabaseAdmin
        .from('email_sync_config')
        .update({
          sync_enabled: false,
          last_sync_error: 'Conexão com o Gmail expirou. Reconecte sua conta para continuar sincronizando.',
        })
        .eq('id', syncConfig.id);
      const err: any = new Error('GMAIL_REAUTH_REQUIRED');
      err.code = 'gmail_reauth_required';
      throw err;
    }
    console.error('[sync-email-replies] Token refresh failed:', tokenData);
    throw new Error(tokenData.error_description || tokenData.error || 'Failed to refresh Gmail access token');
  }

  // Update token in database
  await supabaseAdmin
    .from('email_sync_config')
    .update({
      access_token_encrypted: tokenData.access_token,
      token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
    })
    .eq('id', syncConfig.id);

  return tokenData.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const filterOpportunityId = body.opportunity_id;

    // Get Gmail sync config
    const { data: syncConfig } = await supabaseAdmin
      .from('email_sync_config')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'gmail')
      .eq('sync_enabled', true)
      .maybeSingle();

    if (!syncConfig) {
      return new Response(
        JSON.stringify({ synced: 0, message: 'Gmail sync not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Refresh token if expired
    let accessToken = syncConfig.access_token_encrypted;
    if (syncConfig.token_expires_at && new Date(syncConfig.token_expires_at) < new Date()) {
      accessToken = await refreshAccessToken(supabaseAdmin, syncConfig);
    }

    // Get outbound emails sent from CRM that we want to track replies for
    let outboundQuery = supabaseAdmin
      .from('opportunity_emails')
      .select('id, opportunity_id, organization_id, subject, to_emails, from_email, gmail_thread_id, sent_by, sent_at')
      .eq('direction', 'outbound')
      .eq('sent_by', user.id)
      .order('sent_at', { ascending: false })
      .limit(50);

    if (filterOpportunityId) {
      outboundQuery = outboundQuery.eq('opportunity_id', filterOpportunityId);
    }

    const { data: outboundEmails, error: outboundError } = await outboundQuery;

    if (outboundError) {
      console.error('[sync-email-replies] Error fetching outbound emails:', outboundError);
      throw outboundError;
    }

    if (!outboundEmails || outboundEmails.length === 0) {
      return new Response(
        JSON.stringify({ synced: 0, message: 'No outbound emails to track' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let totalSynced = 0;

    for (const outbound of outboundEmails) {
      try {
        // Strategy: Search Gmail for replies from the recipient about the same subject
        const recipientEmail = outbound.to_emails?.[0];
        if (!recipientEmail) continue;

        // If we already have a thread_id, search by thread
        let searchQuery: string;
        if (outbound.gmail_thread_id) {
          searchQuery = `in:anywhere thread:${outbound.gmail_thread_id}`;
        } else {
          // Search by subject + sender matching recipient
          const cleanSubject = outbound.subject.replace(/^(Re:|Fwd:|Enc:)\s*/gi, '').trim();
          searchQuery = `from:${recipientEmail} subject:"${cleanSubject}"`;
        }

        const searchUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(searchQuery)}&maxResults=10`;
        const searchResponse = await fetch(searchUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!searchResponse.ok) {
          console.error(`[sync-email-replies] Gmail search failed for outbound ${outbound.id}:`, await searchResponse.text());
          continue;
        }

        const searchData = await searchResponse.json();
        const messages: GmailMessage[] = searchData.messages || [];

        for (const msg of messages) {
          // Check if already synced
          const { data: existing } = await supabaseAdmin
            .from('opportunity_emails')
            .select('id')
            .eq('gmail_message_id', msg.id)
            .maybeSingle();

          if (existing) continue;

          // Fetch full message
          const msgResponse = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );

          if (!msgResponse.ok) continue;

          const msgData: GmailMessageDetail = await msgResponse.json();

          const fromHeader = getHeader(msgData.payload.headers, 'From');
          const fromEmail = extractEmailAddress(fromHeader);
          const toHeader = getHeader(msgData.payload.headers, 'To');
          const subject = getHeader(msgData.payload.headers, 'Subject');
          const dateHeader = getHeader(msgData.payload.headers, 'Date');

          // Skip if it's our own sent email (outbound)
          if (fromEmail.toLowerCase() === outbound.from_email.toLowerCase()) {
            // But capture thread_id if we don't have it
            if (!outbound.gmail_thread_id && msgData.threadId) {
              await supabaseAdmin
                .from('opportunity_emails')
                .update({ gmail_thread_id: msgData.threadId, gmail_message_id: msg.id })
                .eq('id', outbound.id);
              outbound.gmail_thread_id = msgData.threadId;
            }
            continue;
          }

          // This is an inbound reply — extract body
          const emailBody = extractBody(msgData.payload);
          const sentAt = dateHeader ? new Date(dateHeader).toISOString() : new Date(parseInt(msgData.internalDate)).toISOString();

          // Insert inbound email
          const { error: insertError } = await supabaseAdmin
            .from('opportunity_emails')
            .insert({
              opportunity_id: outbound.opportunity_id,
              organization_id: outbound.organization_id,
              subject: subject || outbound.subject,
              body: emailBody,
              from_email: fromEmail,
              to_emails: [extractEmailAddress(toHeader)],
              cc_emails: [],
              sent_at: sentAt,
              sent_by: outbound.sent_by, // keep reference to original seller
              direction: 'inbound',
              gmail_message_id: msg.id,
              gmail_thread_id: msgData.threadId,
              in_reply_to: outbound.id,
              opened_count: 0,
            });

          if (insertError) {
            // Likely duplicate — skip
            if (insertError.code === '23505') continue;
            console.error('[sync-email-replies] Insert error:', insertError);
            continue;
          }

          totalSynced++;

          // Create notification for the seller
          // Get account name for context
          const { data: oppData } = await supabaseAdmin
            .from('opportunities')
            .select('title, account:accounts(razao_social, nome_fantasia)')
            .eq('id', outbound.opportunity_id)
            .single();

          const accountName = (oppData?.account as any)?.nome_fantasia || (oppData?.account as any)?.razao_social || '';

          await supabaseAdmin
            .from('notifications')
            .insert({
              user_id: outbound.sent_by,
              organization_id: outbound.organization_id,
              type: 'email_reply_received',
              title: `Nova resposta de e-mail`,
              message: `${fromEmail} respondeu ao e-mail "${subject || outbound.subject}"`,
              metadata: {
                opportunity_id: outbound.opportunity_id,
                opportunity_title: oppData?.title,
                account_name: accountName,
                from_email: fromEmail,
                subject: subject || outbound.subject,
              },
              read: false,
            });

          // PRIME: Trigger client_replied notification via notify-client-reply
          try {
            const notifyUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/notify-client-reply`;
            await fetch(notifyUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify({
                opportunity_id: outbound.opportunity_id,
                channel: "email",
                company_name: accountName,
                contact_name: fromEmail,
                message_preview: emailBody?.slice(0, 200),
              }),
            });
          } catch (notifyErr) {
            console.error("[sync-email-replies] notify-client-reply call failed:", notifyErr);
          }
        }
      } catch (emailError) {
        console.error(`[sync-email-replies] Error processing outbound ${outbound.id}:`, emailError);
      }
    }

    console.log(`[sync-email-replies] Synced ${totalSynced} replies for user ${user.id}`);

    return new Response(
      JSON.stringify({ synced: totalSynced }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[sync-email-replies] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
