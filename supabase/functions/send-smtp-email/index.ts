import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const { to_emails, cc_emails, subject, html_body, opportunity_id, organization_id } = body;

    if (!to_emails?.length || !subject || !html_body) {
      return new Response(JSON.stringify({ error: 'to_emails, subject, and html_body are required' }), {
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

    const toList = Array.isArray(to_emails) ? to_emails : [to_emails];
    const ccList = cc_emails?.length ? (Array.isArray(cc_emails) ? cc_emails : [cc_emails]) : undefined;

    await client.send({
      from: fromAddress,
      to: toList,
      cc: ccList,
      subject: subject,
      html: finalBody,
    });

    await client.close();

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
        })
        .select('*')
        .single();

      if (insertError) {
        console.error('Error logging email:', insertError);
      } else {
        emailRecord = data;
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
