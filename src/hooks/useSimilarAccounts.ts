import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from '@/hooks/useDebounce';

interface SimilarAccount {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  cpf: string | null;
  tipo_pessoa: 'PJ' | 'PF';
  parent_account_id: string | null;
  similarity: number;
}

type TipoPessoa = 'PJ' | 'PF';

export function useSimilarAccounts() {
  const [similarAccounts, setSimilarAccounts] = useState<SimilarAccount[]>([]);
  const [isChecking, setIsChecking] = useState(false);

  const checkSimilarAccounts = useCallback(async (
    name: string, 
    tipoPessoa?: TipoPessoa,
    parentAccountId?: string
  ) => {
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
        p_tipo_pessoa: tipoPessoa || null,
        p_parent_account_id: parentAccountId || null,
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
