// Sync Gmail replies into opportunity_emails timeline.
//
// Three-tier matching cascade for each outbound email (last 60 days):
//   A. Deterministic   — gmail_thread_id already set → search by thread.
//   B. Header-based    — message_id_header present → search Gmail by
//                        rfc822msgid: and in-reply-to: (works even when our
//                        outbound never appeared in the user's Sent folder,
//                        e.g. third-party SMTP domain).
//   C. Heuristic       — search "from:<recipient> to:me newer_than:30d" and
//                        validate via header In-Reply-To/References match
//                        OR normalized subject match.
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

interface GmailThreadDetail {
  id: string;
  messages?: GmailMessageDetail[];
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
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
      if (part.parts) {
        for (const subpart of part.parts) {
          if (subpart.mimeType === 'text/html' && subpart.body?.data) {
            return decodeBase64Url(subpart.body.data);
          }
        }
      }
    }
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

// Normalize subject for fuzzy matching: drop Re:/Fwd:/Enc:, accents, punctuation, lowercase, collapse whitespace.
function normalizeSubject(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^(\s*(re|fwd?|enc|res)\s*:\s*)+/gi, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Extract Message-ID list from In-Reply-To and References headers.
function extractReferencedIds(headers: Array<{ name: string; value: string }>): string[] {
  const inReplyTo = getHeader(headers, 'In-Reply-To');
  const references = getHeader(headers, 'References');
  const combined = `${inReplyTo} ${references}`;
  const ids = combined.match(/<[^<>\s]+>/g) || [];
  return ids.map((s) => s.trim());
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
    const isRevoked = tokenData.error === 'invalid_grant';
    if (isRevoked) {
      console.warn('[sync-email-replies] Refresh token revoked/expired for config', syncConfig.id, '— disabling sync.');
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

  await supabaseAdmin
    .from('email_sync_config')
    .update({
      access_token_encrypted: tokenData.access_token,
      token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
    })
    .eq('id', syncConfig.id);

  return tokenData.access_token;
}

async function gmailSearch(accessToken: string, query: string, maxResults = 10): Promise<GmailMessage[]> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!r.ok) {
    const errBody = await r.text().catch(() => '');
    console.warn(`[sync-email-replies] Gmail search failed (${r.status}) for query: ${query}${errBody ? ` :: ${errBody}` : ''}`);
    return [];
  }
  const d = await r.json();
  return d.messages || [];
}

async function gmailGetMessage(accessToken: string, messageId: string): Promise<GmailMessageDetail | null> {
  const r = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!r.ok) return null;
  return await r.json();
}

async function gmailGetThread(accessToken: string, threadId: string): Promise<GmailThreadDetail | null> {
  const r = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!r.ok) {
    const errBody = await r.text().catch(() => '');
    console.warn(`[sync-email-replies] Gmail thread fetch failed (${r.status}) for thread ${threadId}${errBody ? ` :: ${errBody}` : ''}`);
    return null;
  }
  return await r.json();
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

    let accessToken = syncConfig.access_token_encrypted;
    if (syncConfig.token_expires_at && new Date(syncConfig.token_expires_at) < new Date()) {
      accessToken = await refreshAccessToken(supabaseAdmin, syncConfig);
    }

    // Window: 60 days for org-wide sync; 30 days when filtering by opportunity (more precise).
    const windowDays = filterOpportunityId ? 30 : 60;
    const windowCutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

    let outboundQuery = supabaseAdmin
      .from('opportunity_emails')
      .select('id, opportunity_id, organization_id, subject, to_emails, from_email, gmail_thread_id, gmail_message_id, message_id_header, sent_by, sent_at')
      .eq('direction', 'outbound')
      .eq('sent_by', user.id)
      .gte('sent_at', windowCutoff)
      .order('sent_at', { ascending: false })
      .limit(500);

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
    let outboundsWithoutThread = 0;
    // De-dupe Strategy C calls per recipient (quota-friendly).
    const heuristicCache = new Map<string, GmailMessage[]>();

    for (const outbound of outboundEmails) {
      try {
        const recipientEmail = outbound.to_emails?.[0];
        if (!recipientEmail) continue;

        if (!outbound.gmail_thread_id) outboundsWithoutThread++;

        const candidateMessages: GmailMessage[] = [];

        // ── Strategy A: deterministic by stored thread id ────────────────────
        if (outbound.gmail_thread_id) {
          const thread = await gmailGetThread(accessToken, outbound.gmail_thread_id);
          if (thread?.messages?.length) {
            candidateMessages.push(
              ...thread.messages.map((message) => ({
                id: message.id,
                threadId: message.threadId,
              })),
            );
          }
        }

        // ── Strategy B: find our outbound by Message-ID, then inspect the whole thread.
        if (outbound.message_id_header) {
          const bareId = outbound.message_id_header.replace(/^<|>$/g, '');
          const seedMessages = await gmailSearch(accessToken, `rfc822msgid:${bareId}`, 10);
          for (const seed of seedMessages) {
            const thread = await gmailGetThread(accessToken, seed.threadId);
            if (thread?.messages?.length) {
              candidateMessages.push(
                ...thread.messages.map((message) => ({
                  id: message.id,
                  threadId: message.threadId,
                })),
              );
            } else {
              candidateMessages.push(seed);
            }
          }
        }

        // ── Strategy C: heuristic by recipient + window ──────────────────────
        // Broader lookup because replies can land via alias routing instead of "to:me".
        if (!outbound.gmail_thread_id) {
          const cacheKey = `${recipientEmail}::${user.id}`;
          let cMessages = heuristicCache.get(cacheKey);
          if (!cMessages) {
            cMessages = await gmailSearch(
              accessToken,
              `from:${recipientEmail} newer_than:${windowDays}d`,
              50,
            );
            heuristicCache.set(cacheKey, cMessages);
          }
          candidateMessages.push(...cMessages);
        }

        // De-duplicate by Gmail message id
        const seen = new Set<string>();
        const uniqueCandidates = candidateMessages.filter((m) => {
          if (seen.has(m.id)) return false;
          seen.add(m.id);
          return true;
        });

        const normalizedOutboundSubject = normalizeSubject(outbound.subject);

        for (const msg of uniqueCandidates) {
          // Skip if already imported
          const { data: existing } = await supabaseAdmin
            .from('opportunity_emails')
            .select('id')
            .eq('gmail_message_id', msg.id)
            .maybeSingle();
          if (existing) continue;

          const msgData = await gmailGetMessage(accessToken, msg.id);
          if (!msgData) continue;

          const fromHeader = getHeader(msgData.payload.headers, 'From');
          const fromEmail = extractEmailAddress(fromHeader);
          const toHeader = getHeader(msgData.payload.headers, 'To');
          const subject = getHeader(msgData.payload.headers, 'Subject');
          const dateHeader = getHeader(msgData.payload.headers, 'Date');
          const referencedIds = extractReferencedIds(msgData.payload.headers);

          // Case 1: This Gmail message is OUR own outbound (Sent folder hit).
          // Capture the thread_id for future fast lookups, then skip.
          if (fromEmail.toLowerCase() === outbound.from_email.toLowerCase()) {
            if (!outbound.gmail_thread_id && msgData.threadId) {
              await supabaseAdmin
                .from('opportunity_emails')
                .update({ gmail_thread_id: msgData.threadId, gmail_message_id: msg.id })
                .eq('id', outbound.id);
              outbound.gmail_thread_id = msgData.threadId;
            }
            continue;
          }

          // Case 2: Inbound from someone else. Validate it actually belongs to this outbound.
          // Strong signal: header reference matches our message_id_header.
          // Weak signal: normalized subject matches.
          let isMatch = false;
          if (outbound.message_id_header && referencedIds.includes(outbound.message_id_header)) {
            isMatch = true;
          } else if (outbound.gmail_thread_id && msgData.threadId === outbound.gmail_thread_id) {
            isMatch = true;
          } else {
            const normalizedReplySubject = normalizeSubject(subject);
            // Allow partial containment for forwarded/quoted contexts
            if (
              normalizedReplySubject &&
              normalizedOutboundSubject &&
              (normalizedReplySubject === normalizedOutboundSubject ||
                normalizedReplySubject.includes(normalizedOutboundSubject) ||
                normalizedOutboundSubject.includes(normalizedReplySubject))
            ) {
              // Subject match + sender is the recipient = high confidence
              if (fromEmail.toLowerCase() === recipientEmail.toLowerCase()) {
                isMatch = true;
              }
            }
          }

          if (!isMatch) continue;

          const emailBody = extractBody(msgData.payload);
          const sentAt = dateHeader
            ? new Date(dateHeader).toISOString()
            : new Date(parseInt(msgData.internalDate)).toISOString();

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
              sent_by: outbound.sent_by,
              direction: 'inbound',
              gmail_message_id: msg.id,
              gmail_thread_id: msgData.threadId,
              in_reply_to: outbound.id,
              opened_count: 0,
            });

          if (insertError) {
            if (insertError.code === '23505') continue;
            console.error('[sync-email-replies] Insert error:', insertError);
            continue;
          }

          // Backfill outbound's thread_id from the matched reply for future syncs
          if (!outbound.gmail_thread_id && msgData.threadId) {
            await supabaseAdmin
              .from('opportunity_emails')
              .update({ gmail_thread_id: msgData.threadId })
              .eq('id', outbound.id);
            outbound.gmail_thread_id = msgData.threadId;
          }

          totalSynced++;

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

    console.log(`[sync-email-replies] Synced ${totalSynced} replies for user ${user.id} (scanned ${outboundEmails.length} outbounds, ${outboundsWithoutThread} sem thread)`);

    const responseBody: any = { synced: totalSynced };
    if (totalSynced === 0 && outboundsWithoutThread > 0) {
      responseBody.hint = `${outboundsWithoutThread} e-mail(s) enviado(s) ainda não têm thread Gmail correlacionado. Estamos buscando por header e por janela de tempo — se o cliente respondeu, deve aparecer na próxima sincronização.`;
    }

    return new Response(
      JSON.stringify(responseBody),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[sync-email-replies] Error:', error);
    const code = error?.code;
    const isReauth = code === 'gmail_reauth_required' || error?.message === 'GMAIL_REAUTH_REQUIRED';
    return new Response(
      JSON.stringify({
        error: isReauth
          ? 'Conexão com o Gmail expirou. Reconecte sua conta nas configurações.'
          : (error instanceof Error ? error.message : 'Unknown error'),
        code: isReauth ? 'gmail_reauth_required' : (code || 'sync_failed'),
        reauth_required: isReauth,
      }),
      { status: isReauth ? 409 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
