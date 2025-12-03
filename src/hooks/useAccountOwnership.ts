import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';

interface AccountOwnershipCheck {
  isOwnedByCurrentUser: boolean;
  isOwnedByOtherUser: boolean;
  ownerName: string | null;
  ownerId: string | null;
}

/**
 * Hook to check account ownership - prepares for portfolio protection
 * Returns ownership info for a given account
 */
export function useAccountOwnership(accountId: string | null | undefined) {
  const { user } = useCurrentUser();
  const [ownershipInfo, setOwnershipInfo] = useState<AccountOwnershipCheck>({
    isOwnedByCurrentUser: false,
    isOwnedByOtherUser: false,
    ownerName: null,
    ownerId: null,
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!accountId || !user?.id) {
      setOwnershipInfo({
        isOwnedByCurrentUser: false,
        isOwnedByOtherUser: false,
        ownerName: null,
        ownerId: null,
      });
      return;
    }

    const checkOwnership = async () => {
      setIsLoading(true);
      try {
        // Get account with owner info
        const { data: account, error } = await supabase
          .from('accounts')
          .select(`
            owner_user_id,
            owner:profiles!accounts_owner_user_id_fkey(user_id, full_name)
          `)
          .eq('id', accountId)
          .maybeSingle();

        if (error) {
          console.error('Error checking account ownership:', error);
          return;
        }

        if (account) {
          const ownerId = account.owner_user_id;
          const ownerProfile = account.owner as any;
          
          setOwnershipInfo({
            isOwnedByCurrentUser: ownerId === user.id,
            isOwnedByOtherUser: ownerId !== null && ownerId !== user.id,
            ownerName: ownerProfile?.full_name || null,
            ownerId: ownerId,
          });
        }
      } catch (err) {
        console.error('Error in useAccountOwnership:', err);
      } finally {
        setIsLoading(false);
      }
    };

    checkOwnership();
  }, [accountId, user?.id]);

  return { ...ownershipInfo, isLoading };
}

/**
 * Validation function to check if creating opportunity for account owned by another user
 * Returns warning message if account belongs to another salesperson
 */
export async function validateAccountOwnership(
  accountId: string,
  currentUserId: string
): Promise<{ isValid: boolean; warning?: string; ownerName?: string }> {
  try {
    const { data: account, error } = await supabase
      .from('accounts')
      .select(`
        owner_user_id,
        owner:profiles!accounts_owner_user_id_fkey(full_name)
      `)
      .eq('id', accountId)
      .maybeSingle();

    if (error || !account) {
      return { isValid: true }; // Allow if can't verify
    }

    const ownerId = account.owner_user_id;
    const ownerProfile = account.owner as any;

    // If no owner assigned or owned by current user, it's valid
    if (!ownerId || ownerId === currentUserId) {
      return { isValid: true };
    }

    // Account belongs to another salesperson
    return {
      isValid: false,
      warning: `Esta conta pertence à carteira de ${ownerProfile?.full_name || 'outro vendedor'}`,
      ownerName: ownerProfile?.full_name,
    };
  } catch (err) {
    console.error('Error validating account ownership:', err);
    return { isValid: true }; // Allow if error
  }
}
