import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// Usando fetch direto para enviar emails via Resend API
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

// Schema de validação do payload
const payloadSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email().max(255),
  }),
  email_data: z.object({
    token: z.string().regex(/^\d{6}$/, "Token deve ser 6 dígitos"),
    token_hash: z.string(),
    redirect_to: z.string(),
    email_action_type: z.string(),
  }),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AuthHookPayload {
  user: {
    id: string;
    email: string;
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
  };
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-otp-email function invoked");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawPayload = await req.json();
    
    // Validate payload
    const validationResult = payloadSchema.safeParse(rawPayload);
    if (!validationResult.success) {
      console.error("Invalid payload structure:", validationResult.error);
      return new Response(
        JSON.stringify({ error: "Invalid payload structure", details: validationResult.error.issues }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }
    
    const payload = validationResult.data;
    console.log("Payload validated and received:", { email: payload.user.email, action: payload.email_data.email_action_type });

    const { user, email_data } = payload;
    const { token } = email_data;

    // HTML email template
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
            .header { text-align: center; margin-bottom: 40px; }
            .logo { font-size: 24px; font-weight: bold; color: #2563eb; }
            .code-container { background: #f3f4f6; border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0; }
            .code { font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1f2937; font-family: monospace; }
            .message { font-size: 16px; color: #6b7280; margin: 20px 0; }
            .footer { text-align: center; margin-top: 40px; font-size: 14px; color: #9ca3af; }
            .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">NOID CRM</div>
            </div>
            
            <div class="message">
              <p>Olá,</p>
              <p>Use o código abaixo para fazer login no NOID CRM:</p>
            </div>

            <div class="code-container">
              <div class="code">${token}</div>
            </div>

            <div class="warning">
              <strong>⚠️ Importante:</strong> Este código expira em 1 hora e só pode ser usado uma vez.
            </div>

            <div class="message">
              <p>Se você não solicitou este código, pode ignorar este email com segurança.</p>
            </div>

            <div class="footer">
              <p>NOID CRM - Sistema de Gestão Empresarial</p>
              <p>Este é um email automático, por favor não responda.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send email via Resend API
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "NOID CRM <onboarding@resend.dev>",
        to: [user.email],
        subject: "Seu código de acesso - NOID CRM",
        html: emailHtml,
      }),
    });

    const emailData = await emailResponse.json();
    
    if (!emailResponse.ok) {
      throw new Error(`Resend API error: ${JSON.stringify(emailData)}`);
    }

    console.log("Email sent successfully:", emailData);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-otp-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
