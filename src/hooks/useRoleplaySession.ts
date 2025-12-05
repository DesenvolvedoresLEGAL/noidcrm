import { create } from 'zustand';

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
 */
export function useRoleplaySession() {
  const { isInActiveSession, activeSessionId, setActiveSession } = useRoleplaySessionStore();
  
  return {
    isInActiveSession,
    activeSessionId,
    startSession: (sessionId: string) => setActiveSession(sessionId),
    endSession: () => setActiveSession(null),
  };
}
