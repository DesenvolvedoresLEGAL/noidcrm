import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BackupResult {
  organization_id: string;
  organization_name: string;
  backup_id: string;
  entities_count: Record<string, number>;
  status: 'completed' | 'failed';
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const internalSecret = req.headers.get('x-internal-secret');
  const expectedSecret = Deno.env.get('INTERNAL_WORKFLOW_SECRET');
  if (!expectedSecret || internalSecret !== expectedSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }


  try {
    console.log('[daily-backup-cron] Starting daily backup process...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all active organizations
    const { data: organizations, error: orgsError } = await supabase
      .from('organizations')
      .select('id, name')
      .order('name');

    if (orgsError) {
      console.error('[daily-backup-cron] Error fetching organizations:', orgsError);
      throw orgsError;
    }

    console.log(`[daily-backup-cron] Found ${organizations?.length || 0} organizations to backup`);

    const results: BackupResult[] = [];

    for (const org of organizations || []) {
      console.log(`[daily-backup-cron] Processing backup for organization: ${org.name} (${org.id})`);
      
      try {
        // Create backup history record
        const { data: backupRecord, error: backupError } = await supabase
          .from('backup_history')
          .insert({
            organization_id: org.id,
            backup_type: 'daily',
            status: 'in_progress',
          })
          .select('id')
          .single();

        if (backupError) {
          console.error(`[daily-backup-cron] Error creating backup record for ${org.name}:`, backupError);
          throw backupError;
        }

        // Count entities
        const [opportunities, proposals, accounts, contacts, activities] = await Promise.all([
          supabase.from('opportunities').select('id', { count: 'exact', head: true }).eq('organization_id', org.id).is('deleted_at', null),
          supabase.from('proposals').select('id', { count: 'exact', head: true }).eq('organization_id', org.id),
          supabase.from('accounts').select('id', { count: 'exact', head: true }).eq('organization_id', org.id).is('deleted_at', null),
          supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('organization_id', org.id).is('deleted_at', null),
          supabase.from('activities').select('id', { count: 'exact', head: true }).eq('organization_id', org.id).is('deleted_at', null),
        ]);

        const entitiesCount = {
          opportunities: opportunities.count || 0,
          proposals: proposals.count || 0,
          accounts: accounts.count || 0,
          contacts: contacts.count || 0,
          activities: activities.count || 0,
        };

        const totalEntities = Object.values(entitiesCount).reduce((a, b) => a + b, 0);
        console.log(`[daily-backup-cron] Organization ${org.name} has ${totalEntities} entities to backup`);

        // Create snapshots for opportunities
        if (entitiesCount.opportunities > 0) {
          const { data: opps } = await supabase
            .from('opportunities')
            .select('*')
            .eq('organization_id', org.id)
            .is('deleted_at', null);

          if (opps && opps.length > 0) {
            const snapshots = opps.map(opp => ({
              organization_id: org.id,
              entity_type: 'opportunities',
              entity_id: opp.id,
              snapshot_data: opp,
              snapshot_reason: 'backup_daily',
              expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
            }));

            await supabase.from('entity_snapshots').insert(snapshots);
            console.log(`[daily-backup-cron] Created ${snapshots.length} opportunity snapshots for ${org.name}`);
          }
        }

        // Create snapshots for proposals
        if (entitiesCount.proposals > 0) {
          const { data: props } = await supabase
            .from('proposals')
            .select('*')
            .eq('organization_id', org.id);

          if (props && props.length > 0) {
            const snapshots = props.map(prop => ({
              organization_id: org.id,
              entity_type: 'proposals',
              entity_id: prop.id,
              snapshot_data: prop,
              snapshot_reason: 'backup_daily',
              expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
            }));

            await supabase.from('entity_snapshots').insert(snapshots);
            console.log(`[daily-backup-cron] Created ${snapshots.length} proposal snapshots for ${org.name}`);
          }
        }

        // Create snapshots for accounts
        if (entitiesCount.accounts > 0) {
          const { data: accs } = await supabase
            .from('accounts')
            .select('*')
            .eq('organization_id', org.id)
            .is('deleted_at', null);

          if (accs && accs.length > 0) {
            const snapshots = accs.map(acc => ({
              organization_id: org.id,
              entity_type: 'accounts',
              entity_id: acc.id,
              snapshot_data: acc,
              snapshot_reason: 'backup_daily',
              expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
            }));

            await supabase.from('entity_snapshots').insert(snapshots);
            console.log(`[daily-backup-cron] Created ${snapshots.length} account snapshots for ${org.name}`);
          }
        }

        // Create snapshots for contacts
        if (entitiesCount.contacts > 0) {
          const { data: cons } = await supabase
            .from('contacts')
            .select('*')
            .eq('organization_id', org.id)
            .is('deleted_at', null);

          if (cons && cons.length > 0) {
            const snapshots = cons.map(con => ({
              organization_id: org.id,
              entity_type: 'contacts',
              entity_id: con.id,
              snapshot_data: con,
              snapshot_reason: 'backup_daily',
              expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
            }));

            await supabase.from('entity_snapshots').insert(snapshots);
            console.log(`[daily-backup-cron] Created ${snapshots.length} contact snapshots for ${org.name}`);
          }
        }

        // Update backup record as completed
        await supabase
          .from('backup_history')
          .update({
            status: 'completed',
            entities_count: entitiesCount,
            completed_at: new Date().toISOString(),
          })
          .eq('id', backupRecord.id);

        results.push({
          organization_id: org.id,
          organization_name: org.name,
          backup_id: backupRecord.id,
          entities_count: entitiesCount,
          status: 'completed',
        });

        console.log(`[daily-backup-cron] Backup completed for ${org.name}`);

      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[daily-backup-cron] Error backing up ${org.name}:`, error);
        
        results.push({
          organization_id: org.id,
          organization_name: org.name,
          backup_id: '',
          entities_count: {},
          status: 'failed',
          error: errorMessage,
        });
      }
    }

    // Log summary to audit
    const successCount = results.filter(r => r.status === 'completed').length;
    const failCount = results.filter(r => r.status === 'failed').length;
    
    await supabase.from('audit_log').insert({
      action: 'daily_backup_completed',
      entity_type: 'system',
      metadata: {
        total_organizations: organizations?.length || 0,
        successful_backups: successCount,
        failed_backups: failCount,
        results: results,
      },
    });

    console.log(`[daily-backup-cron] Daily backup completed. Success: ${successCount}, Failed: ${failCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Daily backup completed. ${successCount} successful, ${failCount} failed.`,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[daily-backup-cron] Fatal error:', error);
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
