import { useCallback, useRef, useEffect } from 'react';
import { useDebounce } from './useDebounce';

interface UseFormPersistenceOptions {
  key: string;
  debounceMs?: number;
}

interface StoredDraft<T> {
  data: T;
  savedAt: number;
}

const DRAFT_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export function useFormPersistence<T>({ key, debounceMs = 500 }: UseFormPersistenceOptions) {
  const storageKey = `proposal-draft-${key}`;
  const lastSavedRef = useRef<number>(0);

  // Load draft from localStorage
  const loadDraft = useCallback((): T | null => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) return null;

      const draft: StoredDraft<T> = JSON.parse(stored);
      
      // Check if draft is expired
      if (Date.now() - draft.savedAt > DRAFT_EXPIRY_MS) {
        localStorage.removeItem(storageKey);
        return null;
      }

      return draft.data;
    } catch {
      return null;
    }
  }, [storageKey]);

  // Save draft to localStorage
  const saveDraft = useCallback((data: T) => {
    try {
      const draft: StoredDraft<T> = {
        data,
        savedAt: Date.now(),
      };
      localStorage.setItem(storageKey, JSON.stringify(draft));
      lastSavedRef.current = draft.savedAt;
    } catch (error) {
      console.warn('Failed to save draft to localStorage:', error);
    }
  }, [storageKey]);

  // Clear draft from localStorage
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      lastSavedRef.current = 0;
    } catch (error) {
      console.warn('Failed to clear draft from localStorage:', error);
    }
  }, [storageKey]);

  // Check if draft exists
  const hasDraft = useCallback((): boolean => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) return false;

      const draft: StoredDraft<T> = JSON.parse(stored);
      return Date.now() - draft.savedAt <= DRAFT_EXPIRY_MS;
    } catch {
      return false;
    }
  }, [storageKey]);

  // Get last saved timestamp
  const getLastSavedTime = useCallback((): Date | null => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) return null;

      const draft: StoredDraft<T> = JSON.parse(stored);
      return new Date(draft.savedAt);
    } catch {
      return null;
    }
  }, [storageKey]);

  // Cleanup expired drafts on mount
  useEffect(() => {
    const cleanupExpiredDrafts = () => {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith('proposal-draft-')) {
            const stored = localStorage.getItem(key);
            if (stored) {
              const draft: StoredDraft<unknown> = JSON.parse(stored);
              if (Date.now() - draft.savedAt > DRAFT_EXPIRY_MS) {
                keysToRemove.push(key);
              }
            }
          }
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key));
      } catch {
        // Ignore cleanup errors
      }
    };

    cleanupExpiredDrafts();
  }, []);

  return {
    loadDraft,
    saveDraft,
    clearDraft,
    hasDraft,
    getLastSavedTime,
  };
}
