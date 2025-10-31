import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { proposalId, recipientEmail, recipientName } = await req.json();

    if (!proposalId || !recipientEmail) {
      throw new Error('proposalId and recipientEmail are required');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch proposal with related data
    const { data: proposal, error: proposalError } = await supabaseClient
      .from('proposals')
      .select(`
        *,
        opportunity:opportunities(
          *,
          account:accounts(*)
        ),
        organization:organizations(*)
      `)
      .eq('id', proposalId)
      .single();

    if (proposalError) throw proposalError;

    const org = proposal.organization;
    const clientName = recipientName || proposal.client_name || 'Cliente';

    // Send email using Resend
    const emailResponse = await resend.emails.send({
      from: `${org.name} <onboarding@resend.dev>`,
      to: [recipientEmail],
      subject: `Proposta Comercial: ${proposal.title || 'Nova Proposta'}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: ${org.primary_color || '#000'}; color: white; padding: 20px; text-align: center;">
            <h1>${org.name}</h1>
          </div>
          
          <div style="padding: 30px; background-color: #f9f9f9;">
            <h2>Olá, ${clientName}!</h2>
            <p>Temos o prazer de apresentar nossa proposta comercial.</p>
            
            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: ${org.primary_color || '#000'};">${proposal.title || 'Proposta'}</h3>
              ${proposal.value ? `
                <p style="font-size: 24px; font-weight: bold; color: ${org.primary_color || '#000'};">
                  R$ ${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(proposal.value)}
                </p>
              ` : ''}
              ${proposal.expires_at ? `
                <p><strong>Válida até:</strong> ${new Date(proposal.expires_at).toLocaleDateString('pt-BR')}</p>
              ` : ''}
            </div>

            ${proposal.pdf_url ? `
              <div style="text-align: center; margin: 30px 0;">
                <a href="${proposal.pdf_url}" 
                   style="background-color: ${org.primary_color || '#000'}; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                  Ver Proposta Completa
                </a>
              </div>
            ` : ''}

            <p>Caso tenha qualquer dúvida, estamos à disposição.</p>
            
            <p>Atenciosamente,<br><strong>${org.name}</strong></p>
          </div>
          
          <div style="padding: 20px; text-align: center; color: #666; font-size: 12px;">
            <p>${org.email || ''} ${org.phone ? `| ${org.phone}` : ''}</p>
            ${org.website ? `<p><a href="${org.website}" style="color: ${org.primary_color || '#000'};">${org.website}</a></p>` : ''}
          </div>
        </div>
      `,
    });

    console.log('Email sent successfully:', emailResponse);

    // Update proposal status to 'sent'
    const { error: updateError } = await supabaseClient
      .from('proposals')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .eq('id', proposalId);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ success: true, emailId: emailResponse.data?.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error sending proposal email:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
