import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from './useCurrentUser';

export type SellerRole = 'SDR' | 'BDR' | 'AE' | 'Closer' | 'Hunter' | 'Farmer' | 'AM' | 'CS' | null;

interface SellerData {
  id: string;
  role: SellerRole;
  name: string;
  email: string;
}

/**
 * Hook para buscar o seller_role do usuário atual
 * Usado para determinar qual dashboard GTM exibir
 */
export function useSellerRole() {
  const { user, organization } = useCurrentUser();

  const { data, isLoading, error } = useQuery({
    queryKey: ['seller-role', user?.id, organization?.id],
    queryFn: async (): Promise<SellerData | null> => {
      if (!user?.id || !organization?.id) return null;

      const { data, error } = await supabase
        .from('sellers')
        .select('id, role, name, email')
        .eq('user_id', user.id)
        .eq('organization_id', organization.id)
        .eq('active', true)
        .maybeSingle();

      if (error) {
        console.error('[useSellerRole] Error fetching seller:', error);
        return null;
      }

      return data as SellerData | null;
    },
    enabled: !!user?.id && !!organization?.id,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  return {
    seller: data,
    sellerRole: data?.role || null,
    isLoading,
    error,
  };
}
