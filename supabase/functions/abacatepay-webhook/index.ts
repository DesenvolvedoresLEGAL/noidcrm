import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-abacatepay-signature',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ABACATEPAY_API_KEY = Deno.env.get('ABACATEPAY_API_KEY');
    const ABACATEPAY_WEBHOOK_SECRET = Deno.env.get('ABACATEPAY_WEBHOOK_SECRET');
    if (!ABACATEPAY_API_KEY) {
      throw new Error('ABACATEPAY_API_KEY not configured');
    }
    if (!ABACATEPAY_WEBHOOK_SECRET) {
      console.error('ABACATEPAY_WEBHOOK_SECRET not configured — refusing webhook');
      return new Response(JSON.stringify({ error: 'Webhook signing secret not configured' }), {
        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const rawBody = await req.text();
    const signature = req.headers.get('x-abacatepay-signature') || '';

    // Verify HMAC-SHA256 signature in constant time
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(ABACATEPAY_WEBHOOK_SECRET),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sigBytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(rawBody)));
    const expectedHex = Array.from(sigBytes).map((b) => b.toString(16).padStart(2, '0')).join('');

    // Normalize provided signature (strip optional "sha256=" prefix)
    const providedHex = signature.replace(/^sha256=/i, '').trim().toLowerCase();

    const constantTimeEqual = (a: string, b: string) => {
      if (a.length !== b.length) return false;
      let r = 0;
      for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
      return r === 0;
    };

    if (!providedHex || !constantTimeEqual(providedHex, expectedHex)) {
      console.error('AbacatePay webhook signature invalid', { hasSignature: !!signature });
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = JSON.parse(rawBody);

    console.log('AbacatePay webhook received:', { event: body.event });


    // Process different event types
    const { event, data } = body;

    switch (event) {
      case 'subscription.created':
      case 'subscription.updated': {
        const { subscription, customer, metadata } = data;
        const organizationId = metadata?.organization_id;

        if (!organizationId) {
          console.error('Missing organization_id in webhook metadata');
          break;
        }

        // Upsert subscription
        const { error: subError } = await supabaseClient
          .from('billing_subscriptions')
          .upsert({
            organization_id: organizationId,
            abacatepay_subscription_id: subscription.id,
            abacatepay_customer_id: customer?.id,
            plan_id: metadata?.plan_id || 'unknown',
            plan_name: metadata?.plan_name || 'Assinatura',
            status: subscription.status === 'active' ? 'active' : 'paused',
            current_period_start: subscription.current_period_start,
            current_period_end: subscription.current_period_end,
            amount: subscription.amount || 0,
            currency: 'BRL',
            interval: subscription.interval || 'month',
            metadata: metadata || {},
          }, {
            onConflict: 'organization_id,abacatepay_subscription_id',
          });

        if (subError) {
          console.error('Error upserting subscription:', subError);
        } else {
          console.log('Subscription upserted for org:', organizationId);
        }
        break;
      }

      case 'subscription.canceled': {
        const { subscription, metadata } = data;
        const organizationId = metadata?.organization_id;

        if (organizationId) {
          const { error } = await supabaseClient
            .from('billing_subscriptions')
            .update({
              status: 'canceled',
              canceled_at: new Date().toISOString(),
            })
            .eq('organization_id', organizationId)
            .eq('abacatepay_subscription_id', subscription.id);

          if (error) {
            console.error('Error canceling subscription:', error);
          }
        }
        break;
      }

      case 'payment.paid':
      case 'invoice.paid': {
        const { payment, invoice, metadata } = data;
        const organizationId = metadata?.organization_id;
        const paymentData = payment || invoice;

        if (!organizationId) {
          console.error('Missing organization_id in payment webhook');
          break;
        }

        // Create invoice record
        const { error: invError } = await supabaseClient
          .from('billing_invoices')
          .insert({
            organization_id: organizationId,
            abacatepay_invoice_id: paymentData.id,
            abacatepay_payment_id: paymentData.payment_id || paymentData.id,
            invoice_number: paymentData.invoice_number,
            status: 'paid',
            amount: paymentData.amount || 0,
            currency: 'BRL',
            description: paymentData.description || metadata?.plan_name || 'Pagamento',
            invoice_pdf_url: paymentData.pdf_url,
            paid_at: new Date().toISOString(),
            metadata: metadata || {},
          });

        if (invError) {
          console.error('Error creating invoice:', invError);
        } else {
          console.log('Invoice created for org:', organizationId);
        }
        break;
      }

      case 'payment.failed': {
        const { payment, metadata } = data;
        const organizationId = metadata?.organization_id;

        if (organizationId) {
          // Update subscription status
          await supabaseClient
            .from('billing_subscriptions')
            .update({ status: 'past_due' })
            .eq('organization_id', organizationId);

          // Create failed invoice record
          await supabaseClient
            .from('billing_invoices')
            .insert({
              organization_id: organizationId,
              abacatepay_payment_id: payment.id,
              status: 'failed',
              amount: payment.amount || 0,
              currency: 'BRL',
              description: metadata?.plan_name || 'Pagamento falhou',
              metadata: metadata || {},
            });
        }
        break;
      }

      case 'payment_method.attached': {
        const { payment_method, customer, metadata } = data;
        const organizationId = metadata?.organization_id;

        if (organizationId && payment_method) {
          const { error } = await supabaseClient
            .from('billing_payment_methods')
            .insert({
              organization_id: organizationId,
              abacatepay_payment_method_id: payment_method.id,
              type: payment_method.type || 'card',
              is_default: true,
              card_brand: payment_method.card?.brand,
              card_last4: payment_method.card?.last4,
              card_exp_month: payment_method.card?.exp_month,
              card_exp_year: payment_method.card?.exp_year,
              billing_name: customer?.name,
              billing_email: customer?.email,
            });

          if (error) {
            console.error('Error saving payment method:', error);
          } else {
            console.log('Payment method saved for org:', organizationId);
          }
        }
        break;
      }

      default:
        console.log('Unhandled webhook event:', event);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Webhook processing error:', error);
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
