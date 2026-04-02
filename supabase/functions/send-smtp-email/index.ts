import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

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

    // Authenticate user
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

    // Fetch user's SMTP config
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

    // Append signature if exists
    let finalBody = html_body;
    if (smtpConfig.signature_html) {
      finalBody += `<br/><br/>--<br/>${smtpConfig.signature_html}`;
    }

    // Send via SMTP
    const client = new SmtpClient();

    const connectConfig: any = {
      hostname: smtpConfig.smtp_host,
      port: smtpConfig.smtp_port,
      username: smtpConfig.smtp_user,
      password: smtpConfig.smtp_password_encrypted,
    };

    if (smtpConfig.smtp_port === 465) {
      await client.connectTLS(connectConfig);
    } else {
      await client.connect(connectConfig);
    }

    const fromAddress = smtpConfig.from_name 
      ? `${smtpConfig.from_name} <${smtpConfig.from_email}>` 
      : smtpConfig.from_email;

    await client.send({
      from: fromAddress,
      to: Array.isArray(to_emails) ? to_emails.join(',') : to_emails,
      cc: cc_emails?.length ? (Array.isArray(cc_emails) ? cc_emails.join(',') : cc_emails) : undefined,
      subject: subject,
      content: "text/html",
      html: finalBody,
    });

    await client.close();

    // Log to opportunity_emails if opportunity_id provided
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
          to_emails: Array.isArray(to_emails) ? to_emails : [to_emails],
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
