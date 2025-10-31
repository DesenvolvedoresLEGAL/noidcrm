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

    // Fetch items to show in email
    const { data: items } = await supabaseClient
      .from('proposal_items')
      .select('*')
      .eq('proposal_id', proposalId)
      .order('order_index', { ascending: true })
      .limit(5);

    const totalItems = items?.length || 0;
    const totalAmount = items?.reduce((sum, item) => sum + item.total, 0) || 0;

    const org = proposal.organization;
    const clientName = recipientName || proposal.client_name || 'Cliente';
    const publicUrl = proposal.public_token 
      ? `${Deno.env.get('SUPABASE_URL')?.replace('/supabase.co', '.supabase.co')}/public/proposal/${proposal.public_token}`
      : null;

    // Send email using Resend
    const emailResponse = await resend.emails.send({
      from: `${org.name} <onboarding@resend.dev>`,
      to: [recipientEmail],
      subject: `Proposta Comercial: ${proposal.title || 'Nova Proposta'}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; background-color: #f9f9f9;">
          <!-- Header -->
          <div style="background-color: ${org.primary_color || '#000'}; color: white; padding: 30px; text-align: center;">
            ${org.logo_url ? `<img src="${org.logo_url}" alt="${org.name}" style="max-width: 180px; margin-bottom: 15px;" />` : ''}
            <h1 style="margin: 0; font-size: 28px;">${org.name}</h1>
          </div>
          
          <!-- Body -->
          <div style="padding: 40px 30px; background-color: #ffffff;">
            <h2 style="color: #333; margin-bottom: 20px;">Olá, ${clientName}!</h2>
            <p style="color: #555; line-height: 1.7; margin-bottom: 20px;">
              Temos o prazer de apresentar nossa <strong>proposta comercial</strong> especialmente preparada para você.
            </p>
            
            <!-- Proposal Card -->
            <div style="background-color: #f5f7fa; padding: 25px; border-radius: 12px; margin: 30px 0; border-left: 4px solid ${org.primary_color || '#000'};">
              <h3 style="color: ${org.primary_color || '#000'}; margin: 0 0 15px 0; font-size: 20px;">
                ${proposal.title || 'Proposta Comercial'}
              </h3>
              ${totalAmount > 0 ? `
                <p style="font-size: 32px; font-weight: bold; color: ${org.primary_color || '#000'}; margin: 15px 0;">
                  R$ ${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(totalAmount)}
                </p>
              ` : ''}
              ${totalItems > 0 ? `
                <p style="color: #666; margin: 10px 0;">
                  <strong>${totalItems} ${totalItems === 1 ? 'item incluído' : 'itens incluídos'}</strong>
                </p>
              ` : ''}
              ${proposal.expires_at ? `
                <p style="color: #666; margin: 10px 0;">
                  <strong>Válida até:</strong> ${new Date(proposal.expires_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              ` : ''}
            </div>

            ${items && items.length > 0 ? `
              <h4 style="color: #333; margin: 25px 0 15px 0;">Itens em Destaque:</h4>
              <ul style="list-style: none; padding: 0; margin: 0;">
                ${items.slice(0, 3).map(item => `
                  <li style="padding: 12px 0; border-bottom: 1px solid #e0e0e0;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <span style="color: #333; font-weight: 500;">${item.name}</span>
                      <span style="color: #666; font-weight: bold;">R$ ${item.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </li>
                `).join('')}
                ${items.length > 3 ? `
                  <li style="padding: 12px 0; color: #999; font-style: italic;">
                    + ${items.length - 3} ${items.length - 3 === 1 ? 'outro item' : 'outros itens'}
                  </li>
                ` : ''}
              </ul>
            ` : ''}

            ${proposal.introduction ? `
              <div style="margin: 30px 0; padding: 20px; background: #f9f9f9; border-radius: 8px; line-height: 1.7;">
                ${proposal.introduction.replace(/\n/g, '<br />')}
              </div>
            ` : ''}

            <!-- CTA Buttons -->
            <div style="text-align: center; margin: 40px 0 30px;">
              ${publicUrl ? `
                <a href="${publicUrl}" 
                   style="background-color: ${org.primary_color || '#000'}; color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px; margin: 10px;">
                  📄 Visualizar Proposta Completa
                </a>
              ` : ''}
              ${proposal.pdf_url ? `
                <a href="${proposal.pdf_url}" 
                   style="background-color: #fff; color: ${org.primary_color || '#000'}; padding: 16px 40px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px; margin: 10px; border: 2px solid ${org.primary_color || '#000'};">
                  📥 Baixar PDF
                </a>
              ` : ''}
            </div>

            <p style="color: #666; line-height: 1.7; margin-top: 30px;">
              Estamos à disposição para esclarecer qualquer dúvida e discutir os detalhes desta proposta.
            </p>
            
            <p style="margin-top: 30px; color: #333;">
              Atenciosamente,<br>
              <strong style="color: ${org.primary_color || '#000'}; font-size: 16px;">${org.name}</strong>
            </p>
          </div>
          
          <!-- Footer -->
          <div style="padding: 25px 30px; text-align: center; background-color: #f5f5f5; border-top: 3px solid ${org.primary_color || '#000'};">
            <p style="margin: 8px 0; color: #666; font-size: 14px;">
              ${org.email || ''} ${org.phone ? `| ${org.phone}` : ''}
            </p>
            ${org.website ? `
              <p style="margin: 8px 0;">
                <a href="${org.website}" style="color: ${org.primary_color || '#000'}; text-decoration: none; font-weight: 500;">
                  ${org.website}
                </a>
              </p>
            ` : ''}
            ${org.address_street ? `
              <p style="margin: 8px 0; color: #888; font-size: 12px;">
                ${org.address_street}${org.address_number ? `, ${org.address_number}` : ''} - 
                ${org.address_city || ''}${org.address_state ? `/${org.address_state}` : ''}
              </p>
            ` : ''}
            <p style="margin-top: 20px; color: #999; font-size: 11px; font-style: italic;">
              Este é um email automático. Por favor, não responda diretamente.
            </p>
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
