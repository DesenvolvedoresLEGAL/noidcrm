import { supabase } from '@/integrations/supabase/client';

export interface EmailSyncConfig {
  id: string;
  user_id: string;
  organization_id: string;
  provider: 'gmail' | 'outlook';
  email_address: string;
  sync_enabled: boolean;
  last_sync_at: string | null;
  auto_log_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface CalendarSyncConfig {
  id: string;
  user_id: string;
  organization_id: string;
  provider: 'google' | 'outlook';
  calendar_id: string | null;
  calendar_name: string | null;
  sync_enabled: boolean;
  last_sync_at: string | null;
  auto_log_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface SyncLog {
  id: string;
  user_id: string;
  organization_id: string;
  sync_type: 'email' | 'calendar';
  provider: string;
  status: 'success' | 'partial' | 'failed';
  items_processed: number;
  items_created: number;
  items_updated: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

// Email Sync
export async function getEmailSyncConfig(): Promise<EmailSyncConfig | null> {
  const { data, error } = await supabase
    .from('email_sync_config')
    .select('*')
    .maybeSingle();

  if (error) throw error;
  return data as EmailSyncConfig | null;
}

export async function toggleEmailSync(enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from('email_sync_config')
    .update({ sync_enabled: enabled })
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

  if (error) throw error;
}

export async function deleteEmailSyncConfig(): Promise<void> {
  const { error } = await supabase
    .from('email_sync_config')
    .delete()
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

  if (error) throw error;
}

export async function initiateGmailOAuth(): Promise<void> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('User not authenticated');

  const state = btoa(JSON.stringify({ user_id: user.id }));
  const redirectUri = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gmail-oauth-callback`;
  
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', 'YOUR_GOOGLE_CLIENT_ID'); // Will be set via env
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.email');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');

  window.location.href = authUrl.toString();
}

export async function syncEmails(): Promise<{ itemsProcessed: number; itemsCreated: number }> {
  const { data, error } = await supabase.functions.invoke('sync-emails', {
    body: {},
  });

  if (error) throw error;
  return data;
}

// Calendar Sync
export async function getCalendarSyncConfig(): Promise<CalendarSyncConfig | null> {
  const { data, error } = await supabase
    .from('calendar_sync_config')
    .select('*')
    .maybeSingle();

  if (error) throw error;
  return data as CalendarSyncConfig | null;
}

export async function toggleCalendarSync(enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from('calendar_sync_config')
    .update({ sync_enabled: enabled })
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

  if (error) throw error;
}

export async function deleteCalendarSyncConfig(): Promise<void> {
  const { error } = await supabase
    .from('calendar_sync_config')
    .delete()
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

  if (error) throw error;
}

export async function initiateGoogleCalendarOAuth(): Promise<void> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('User not authenticated');

  const state = btoa(JSON.stringify({ user_id: user.id }));
  const redirectUri = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-oauth-callback`;
  
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', 'YOUR_GOOGLE_CLIENT_ID');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/calendar.readonly');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');

  window.location.href = authUrl.toString();
}

export async function syncCalendar(): Promise<{ itemsProcessed: number; itemsCreated: number }> {
  const { data, error } = await supabase.functions.invoke('sync-calendar', {
    body: {},
  });

  if (error) throw error;
  return data;
}

// Sync Logs
export async function getSyncLogs(syncType?: 'email' | 'calendar', limit = 20): Promise<SyncLog[]> {
  let query = supabase
    .from('sync_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (syncType) {
    query = query.eq('sync_type', syncType);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data || []) as SyncLog[];
}