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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { smtp_host, smtp_port, smtp_user, smtp_password, from_email, from_name } = await req.json();

    if (!smtp_host || !smtp_port || !smtp_user || !smtp_password || !from_email) {
      return new Response(JSON.stringify({ error: 'Missing required SMTP fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      const client = new SMTPClient({
        connection: {
          hostname: smtp_host,
          port: Number(smtp_port),
          tls: Number(smtp_port) === 465,
          auth: {
            username: smtp_user,
            password: smtp_password,
          },
        },
      });

      await client.send({
        from: from_name ? `${from_name} <${from_email}>` : from_email,
        to: from_email,
        subject: "Teste de Conexao SMTP - CRM",
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #22c55e;">Conexao SMTP verificada com sucesso!</h2>
            <p>Este e um e-mail de teste para confirmar que sua configuracao SMTP esta funcionando corretamente.</p>
            <hr style="border: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="color: #6b7280; font-size: 12px;">
              Servidor: ${smtp_host}:${smtp_port}<br/>
              Usuario: ${smtp_user}<br/>
              Remetente: ${from_email}
            </p>
          </div>
        `,
      });

      await client.close();

      return new Response(
        JSON.stringify({ success: true, message: 'Conexao SMTP testada com sucesso! E-mail de teste enviado.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (smtpError) {
      console.error('SMTP connection error:', smtpError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Falha na conexao SMTP: ${smtpError instanceof Error ? smtpError.message : 'Erro desconhecido'}` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error in test-smtp-connection:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
