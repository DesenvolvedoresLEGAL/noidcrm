import { supabase } from '@/integrations/supabase/client';
import { Activity } from '../crm/types';
import { addActivityParticipants, updateActivityParticipants } from '../crm/activity-participants';
import { processPendingWorkflows } from '../crm/workflow-rules';
import { z } from 'zod';
...
export async function completeActivity(id: string): Promise<Activity> {
  const activity = await updateActivity(id, {
    status: 'completed',
    completed_at: new Date().toISOString(),
  });

  if (activity.opportunity_id) {
    try {
      await processPendingWorkflows(activity.opportunity_id);
    } catch (error) {
      console.error('[completeActivity] Erro ao processar workflows pendentes:', error);
    }
  }

  return activity;
}

export async function markActivityAsNoShow(id: string): Promise<Activity> {
  return updateActivity(id, {
    status: 'no_show',
    completed_at: new Date().toISOString(),
  });
}

export async function getActivityStats(ownerUserIds?: string[]) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const withOwnerFilter = (q: any) => {
    if (ownerUserIds && ownerUserIds.length > 0) return q.in('owner_user_id', ownerUserIds);
    return q;
  };

  const [overdue, today, thisWeek, thisMonth, scheduled] = await Promise.all([
    withOwnerFilter(
      supabase.from('activities').select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
        .lt('scheduled_date', startOfToday)
    ),

    withOwnerFilter(
      supabase.from('activities').select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
        .gte('scheduled_date', startOfToday)
        .lt('scheduled_date', endOfToday)
    ),

    withOwnerFilter(
      supabase.from('activities').select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
        .gte('scheduled_date', startOfWeek)
        .lt('scheduled_date', endOfToday)
    ),

    withOwnerFilter(
      supabase.from('activities').select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
        .gte('scheduled_date', startOfMonth)
    ),

    withOwnerFilter(
      supabase.from('activities').select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
    ),
  ]);

  return {
    overdue: overdue.count || 0,
    today: today.count || 0,
    thisWeek: thisWeek.count || 0,
    thisMonth: thisMonth.count || 0,
    scheduled: scheduled.count || 0,
  };
}
