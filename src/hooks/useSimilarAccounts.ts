import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from '@/hooks/useDebounce';

interface SimilarAccount {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  similarity: number;
}

export function useSimilarAccounts() {
  const [similarAccounts, setSimilarAccounts] = useState<SimilarAccount[]>([]);
  const [isChecking, setIsChecking] = useState(false);

  const checkSimilarAccounts = useCallback(async (name: string) => {
    if (!name || name.trim().length < 3) {
      setSimilarAccounts([]);
      return;
    }

    setIsChecking(true);
    try {
      const { data, error } = await supabase.rpc('find_similar_accounts', {
        p_name: name.trim(),
        p_org_id: null, // Will be replaced by RLS context
        p_threshold: 0.3,
      });

      if (error) {
        console.error('Error checking similar accounts:', error);
        setSimilarAccounts([]);
        return;
      }

      setSimilarAccounts(data || []);
    } catch (err) {
      console.error('Error in checkSimilarAccounts:', err);
      setSimilarAccounts([]);
    } finally {
      setIsChecking(false);
    }
  }, []);

  const clearSimilarAccounts = useCallback(() => {
    setSimilarAccounts([]);
  }, []);

  // Helper to determine severity of match
  const getMatchSeverity = useCallback((similarity: number): 'high' | 'medium' | 'low' | null => {
    if (similarity >= 0.9) return 'high';
    if (similarity >= 0.7) return 'medium';
    if (similarity >= 0.3) return 'low';
    return null;
  }, []);

  // Check if creation should be blocked (very high similarity)
  const shouldBlockCreation = similarAccounts.some(acc => acc.similarity >= 0.9);

  // Check if warning should be shown
  const shouldShowWarning = similarAccounts.length > 0;

  return {
    similarAccounts,
    isChecking,
    checkSimilarAccounts,
    clearSimilarAccounts,
    getMatchSeverity,
    shouldBlockCreation,
    shouldShowWarning,
  };
}
