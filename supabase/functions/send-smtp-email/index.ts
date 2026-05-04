import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function injectTracking(html: string, emailId: string, baseUrl: string): string {
  const trackOpenUrl = `${baseUrl}/functions/v1/track-email-open?id=${emailId}`;
  const pixel = `<img src="${trackOpenUrl}" width="1" height="1" style="display:none;border:0;" alt="" />`;

  let result = html;
  if (result.includes('</body>')) {
    result = result.replace('</body>', `${pixel}</body>`);
  } else {
    result += pixel;
  }

  result = result.replace(/href="(https?:\/\/[^"]+)"/gi, (_match, url) => {
    const trackClickUrl = `${baseUrl}/functions/v1/track-email-click?id=${emailId}&url=${encodeURIComponent(url)}`;
    return `href="${trackClickUrl}"`;
  });

  return result;
}

function generateMessageId(emailId: string, domain: string): string {
  return `<${emailId}@${domain}>`;
}

async function backgroundGmailThreadLookup(params: {
  supabaseAdmin: any;
  emailRecordId: string;
  userId: string;
  fromEmail: string;
  toEmail: string;
  subject: string;
  messageIdHeader?: string;
}) {
  const { supabaseAdmin, emailRecordId, userId, fromEmail, toEmail, subject, messageIdHeader } = params;
  const delays = [3000, 20000, 90000];

  for (let attempt = 0; attempt < delays.length; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, delays[attempt]));

    try {
      const { data: current } = await supabaseAdmin
        .from('opportunity_emails')
        .select('gmail_thread_id')
        .eq('id', emailRecordId)
        .maybeSingle();

      if (current?.gmail_thread_id) return;

      const { data: syncConfig } = await supabaseAdmin
        .from('email_sync_config')
        .select('id, access_token_encrypted, token_expires_at, refresh_token_encrypted')
        .eq('user_id', userId)
        .eq('provider', 'gmail')
        .eq('sync_enabled', true)
        .maybeSingle();

      if (!syncConfig?.access_token_encrypted) return;

      let accessToken = syncConfig.access_token_encrypted;

      if (syncConfig.token_expires_at && new Date(syncConfig.token_expires_at) < new Date()) {
        const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
        const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
        if (clientId && clientSecret && syncConfig.refresh_token_encrypted) {
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
          if (tokenData.access_token) {
            accessToken = tokenData.access_token;
            await supabaseAdmin
              .from('email_sync_config')
              .update({
                access_token_encrypted: tokenData.access_token,
                token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
              })
              .eq('id', syncConfig.id);
          }
        }
      }

      let foundMessage: { id: string; threadId: string } | null = null;

      if (messageIdHeader) {
        const bareId = messageIdHeader.replace(/^<|>$/g, '');
        const searchUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(`rfc822msgid:${bareId}`)}&maxResults=1`;
        const searchResponse = await fetch(searchUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          foundMessage = searchData.messages?.[0] ?? null;
        }
      }

      if (!foundMessage) {
        const cleanSubject = subject.replace(/"/g, '');
        const fallbackQuery = `from:${fromEmail} to:${toEmail} subject:"${cleanSubject}" newer_than:1d`;
        const searchUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(fallbackQuery)}&maxResults=1`;
        const searchResponse = await fetch(searchUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          foundMessage = searchData.messages?.[0] ?? null;
        }
      }

      if (foundMessage?.threadId) {
        await supabaseAdmin
          .from('opportunity_emails')
          .update({
            gmail_message_id: foundMessage.id,
            gmail_thread_id: foundMessage.threadId,
          })
          .eq('id', emailRecordId);
        return;
      }
    } catch (gmailError) {
      console.error('[send-smtp-email] Gmail thread lookup failed:', gmailError);
    }
  }
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

    const body = await req.json();
    const { to_emails, cc_emails, subject, html_body, opportunity_id, organization_id, attachments } = body;

    if (!to_emails?.length || !subject || !html_body) {
      return new Response(JSON.stringify({ error: 'to_emails, subject, and html_body are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate attachments size (max 10MB total)
    const attachmentList: Array<{ filename: string; content_type: string; content_base64: string }> =
      Array.isArray(attachments) ? attachments : [];
    const totalAttachmentBytes = attachmentList.reduce(
      (sum, a) => sum + Math.ceil((a.content_base64?.length || 0) * 3 / 4),
      0
    );
    if (totalAttachmentBytes > 10 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'Tamanho total dos anexos excede 10MB' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: smtpConfig, error: smtpError } = await supabaseAdmin
      .from('user_smtp_configs')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (smtpError || !smtpConfig) {
      return new Response(JSON.stringify({ error: 'SMTP not configured or not active for this user' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let finalBody = html_body;
    if (smtpConfig.signature_html) {
      finalBody += `<br/><br/>--<br/>${smtpConfig.signature_html}`;
    }

    const toList = Array.isArray(to_emails) ? to_emails : [to_emails];
    const ccList = cc_emails?.length ? (Array.isArray(cc_emails) ? cc_emails : [cc_emails]) : undefined;

    // Step 1: Insert email record BEFORE sending (to get emailId for tracking)
    let emailRecord = null;
    if (opportunity_id) {
      const orgId = organization_id || smtpConfig.organization_id;
      const { data, error: insertError } = await supabaseAdmin
        .from('opportunity_emails')
        .insert({
          opportunity_id,
          organization_id: orgId,
          subject,
          body: finalBody,
          from_email: smtpConfig.from_email,
          to_emails: toList,
          cc_emails: Array.isArray(cc_emails) ? cc_emails : (cc_emails ? [cc_emails] : []),
          sent_by: user.id,
          sent_at: new Date().toISOString(),
          opened_count: 0,
          direction: 'outbound',
        })
        .select('*')
        .single();

      if (insertError) {
        console.error('Error logging email:', insertError);
      } else {
        emailRecord = data;
      }
    }

    // Step 2: Inject tracking pixel and rewrite links if we have an emailId
    let bodyToSend = finalBody;
    if (emailRecord?.id) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      bodyToSend = injectTracking(finalBody, emailRecord.id, supabaseUrl);
    }

    // Step 3: Generate a custom Message-ID for thread tracking
    const emailDomain = smtpConfig.from_email.split('@')[1] || 'noidcrm.app';
    const customMessageId = emailRecord?.id
      ? generateMessageId(emailRecord.id, emailDomain)
      : undefined;

    if (emailRecord?.id && customMessageId) {
      await supabaseAdmin
        .from('opportunity_emails')
        .update({ message_id_header: customMessageId })
        .eq('id', emailRecord.id);
    }

    // Step 4: Send via SMTP
    const client = new SMTPClient({
      connection: {
        hostname: smtpConfig.smtp_host,
        port: smtpConfig.smtp_port,
        tls: smtpConfig.smtp_port === 465,
        auth: {
          username: smtpConfig.smtp_user,
          password: smtpConfig.smtp_password_encrypted,
        },
      },
    });

    const fromAddress = smtpConfig.from_name 
      ? `${smtpConfig.from_name} <${smtpConfig.from_email}>` 
      : smtpConfig.from_email;

    const sendOptions: any = {
      from: fromAddress,
      to: toList,
      cc: ccList,
      subject: subject,
      html: bodyToSend,
    };

    if (customMessageId) {
      sendOptions.headers = new Map<string, string>([['Message-ID', customMessageId]]);
    }

    if (attachmentList.length > 0) {
      sendOptions.attachments = attachmentList.map((a) => ({
        filename: a.filename,
        contentType: a.content_type || 'application/octet-stream',
        encoding: 'base64',
        content: a.content_base64,
      }));
    }

    await client.send(sendOptions);
    await client.close();

    if (emailRecord?.id) {
      try {
        // @ts-ignore EdgeRuntime is available in Supabase Edge Functions
        EdgeRuntime.waitUntil(
          backgroundGmailThreadLookup({
            supabaseAdmin,
            emailRecordId: emailRecord.id,
            userId: user.id,
            fromEmail: smtpConfig.from_email,
            toEmail: toList[0],
            subject,
            messageIdHeader: customMessageId,
          })
        );
      } catch (gmailError) {
        console.error('[send-smtp-email] Failed to schedule Gmail thread lookup:', gmailError);
      }
    }

    return new Response(
      JSON.stringify({ success: true, emailId: emailRecord?.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in send-smtp-email:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
