import { create } from 'zustand';
import { useCallback } from 'react';

/**
 * Global state to track if user is in an active roleplay session.
 * Prevents silent logout during training which causes data loss.
 */
interface RoleplaySessionState {
  isInActiveSession: boolean;
  activeSessionId: string | null;
  setActiveSession: (sessionId: string | null) => void;
}

export const useRoleplaySessionStore = create<RoleplaySessionState>((set) => ({
  isInActiveSession: false,
  activeSessionId: null,
  setActiveSession: (sessionId) => set({ 
    isInActiveSession: !!sessionId,
    activeSessionId: sessionId 
  }),
}));

/**
 * Hook to check and manage roleplay session state
 * Returns stable function references to prevent re-render loops
 */
export function useRoleplaySession() {
  const isInActiveSession = useRoleplaySessionStore((state) => state.isInActiveSession);
  const activeSessionId = useRoleplaySessionStore((state) => state.activeSessionId);
  const setActiveSession = useRoleplaySessionStore((state) => state.setActiveSession);
  
  // Stable function references using useCallback
  const startSession = useCallback((sessionId: string) => {
    setActiveSession(sessionId);
  }, [setActiveSession]);
  
  const endSession = useCallback(() => {
    setActiveSession(null);
  }, [setActiveSession]);
  
  return {
    isInActiveSession,
    activeSessionId,
    startSession,
    endSession,
  };
}
