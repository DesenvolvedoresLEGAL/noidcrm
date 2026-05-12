import { useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useDeviceFingerprint } from './useDeviceFingerprint';
import { logAuthAuditBestEffortFailed, logAuthLoginSuccessWithAuditWarning } from '@/lib/authDiagnostics';

type AuthEventType = 'login' | 'logout' | 'signup' | 'failed_login' | 'password_reset' | 'session_refresh';

export function useSupabaseAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { fingerprint } = useDeviceFingerprint();

  // Track auth events (fire-and-forget, non-blocking)
  const trackAuthEvent = useCallback(async (
    eventType: AuthEventType,
    email: string,
    userId?: string,
    success = true,
    errorMessage?: string
  ) => {
    try {
      window.setTimeout(() => {
        const ctrl = new AbortController();
        const timeout = window.setTimeout(() => ctrl.abort(), 2000);

        supabase.functions.invoke('track-auth-event', {
          body: {
            event_type: eventType,
            user_id: userId,
            email,
            success,
            error_message: errorMessage,
            fingerprint,
            audit_context: {
              userAgent: navigator.userAgent,
              referrer: document.referrer || '',
              pageUrl: window.location.href,
            },
          },
          signal: ctrl.signal,
        }).then(({ data, error }) => {
          if (error) {
            const message = String((error as any)?.message || error || 'unknown_error');
            logAuthAuditBestEffortFailed({
              status: (error as any)?.context?.status,
              message,
              isHtmlResponse: message.toLowerCase().includes('<html') || message.toLowerCase().includes('text/html'),
            });
            return;
          }

          if (data?.success === false) {
            logAuthAuditBestEffortFailed({
              message: String(data?.error || 'tracking_unavailable'),
              isHtmlResponse: false,
            });
            return;
          }

          if (data?.inserted === false) {
            logAuthAuditBestEffortFailed({
              message: 'auth_audit_insert_failed',
              isHtmlResponse: false,
            });
            if (eventType === 'login' || eventType === 'session_refresh') {
              logAuthLoginSuccessWithAuditWarning(userId);
            }
          }
        }).catch((err) => {
          const message = String((err as any)?.message || err || 'unknown_error');
          logAuthAuditBestEffortFailed({
            status: (err as any)?.context?.status,
            message,
            isHtmlResponse: message.toLowerCase().includes('<html') || message.toLowerCase().includes('text/html'),
          });
          if (eventType === 'login' || eventType === 'session_refresh') {
            logAuthLoginSuccessWithAuditWarning(userId);
          }
        }).finally(() => {
          window.clearTimeout(timeout);
        });
      }, 0);
    } catch (e) {
      console.warn('[Auth] Tracking error:', e);
    }
  }, [fingerprint]);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Track session events (SIGNED_IN includes token refresh and session restoration)
        if (session?.user && event === 'SIGNED_IN') {
          const lastLoginKey = `last_login_tracked_${session.user.id}`;
          const lastTracked = localStorage.getItem(lastLoginKey);
          const now = Date.now();
          
          // Throttle: only track if more than 1 hour since last track
          if (!lastTracked || (now - parseInt(lastTracked)) > 3600000) {
            trackAuthEvent('session_refresh', session.user.email!, session.user.id, true);
            localStorage.setItem(lastLoginKey, now.toString());
          }
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [trackAuthEvent]);

  const signUp = async (email: string, password: string, fullName?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
        emailRedirectTo: `${window.location.origin}/`,
      },
    });
    
    if (!error && data?.user) {
      trackAuthEvent('signup', email, data.user.id, true);
    }
    
    return { data, error };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      trackAuthEvent('failed_login', email, undefined, false, error.message);
    } else if (data?.user && data?.session) {
      setSession(data.session);
      setUser(data.user);
      trackAuthEvent('login', email, data.user.id, true);
    }
    
    return { data, error };
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    
    trackAuthEvent('password_reset', email, undefined, !error, error?.message);
    
    return { error };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    return { error };
  };

  const signOut = async () => {
    const currentUser = user;
    const { error } = await supabase.auth.signOut();
    
    if (!error && currentUser?.email) {
      trackAuthEvent('logout', currentUser.email, currentUser.id, true);
    }
    
    return { error };
  };

  return { 
    user, 
    session, 
    loading, 
    signUp, 
    signIn, 
    resetPassword, 
    updatePassword, 
    signOut 
  };
}
