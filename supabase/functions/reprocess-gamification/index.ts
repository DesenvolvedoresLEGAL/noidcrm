import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[reprocess-gamification] Starting historical reprocessing...');

    // Get all completed sessions that haven't been processed for gamification
    const { data: sessions, error: sessionsError } = await supabase
      .from('roleplay_sessions')
      .select('id, seller_id, finished_at')
      .not('finished_at', 'is', null)
      .gte('exchanges_count', 5)
      .order('finished_at', { ascending: true });

    if (sessionsError) {
      throw sessionsError;
    }

    console.log(`[reprocess-gamification] Found ${sessions?.length || 0} completed sessions`);

    // Get unique sellers
    const uniqueSellers = [...new Set(sessions?.map(s => s.seller_id).filter(Boolean))];
    console.log(`[reprocess-gamification] Processing ${uniqueSellers.length} unique sellers`);

    const results: any[] = [];

    for (const sellerId of uniqueSellers) {
      try {
        // Get seller's sessions
        const sellerSessions = sessions?.filter(s => s.seller_id === sellerId) || [];
        
        // Process gamification for this seller (using the most recent session)
        const latestSession = sellerSessions[sellerSessions.length - 1];
        
        console.log(`[reprocess-gamification] Processing seller ${sellerId} with ${sellerSessions.length} sessions`);

        // Call gamification engine
        const { data: gamResult, error: gamError } = await supabase.functions.invoke('gamification-engine', {
          body: {
            sellerId,
            sessionId: latestSession?.id
          }
        });

        if (gamError) {
          console.error(`[reprocess-gamification] Error for seller ${sellerId}:`, gamError);
          results.push({ sellerId, success: false, error: gamError.message });
        } else {
          results.push({ 
            sellerId, 
            success: true, 
            newBadges: gamResult?.newBadges?.length || 0,
            xpEarned: gamResult?.xpEarned || 0,
            level: gamResult?.level?.level || 1
          });
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`[reprocess-gamification] Error processing seller ${sellerId}:`, error);
        results.push({ sellerId, success: false, error: String(error) });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const totalBadges = results.reduce((sum, r) => sum + (r.newBadges || 0), 0);
    const totalXP = results.reduce((sum, r) => sum + (r.xpEarned || 0), 0);

    console.log(`[reprocess-gamification] Completed. ${successCount}/${uniqueSellers.length} sellers processed`);
    console.log(`[reprocess-gamification] Total badges: ${totalBadges}, Total XP: ${totalXP}`);

    return new Response(JSON.stringify({
      success: true,
      processed: successCount,
      total: uniqueSellers.length,
      totalBadgesAwarded: totalBadges,
      totalXPAwarded: totalXP,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[reprocess-gamification] Error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to reprocess gamification' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});