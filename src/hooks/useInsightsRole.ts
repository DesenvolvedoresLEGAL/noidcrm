import { useCurrentUser } from '@/hooks/useCurrentUser';

export type InsightsExperience = 'owner' | 'manager' | 'finance' | 'cs' | 'sdr' | 'sales';

interface InsightsRoleResult {
  experience: InsightsExperience;
  orgRole: string | null;
  sellerRole: string | null;
  isLoading: boolean;
  title: string;
  subtitle: string;
}

export function useInsightsRole(): InsightsRoleResult {
  const { membership, profile, isAuthenticated } = useCurrentUser();
  
  const orgRole = membership?.org_role || null;
  // seller_role is stored in sellers table, not in membership - fallback to sales for sellers
  const sellerRole = orgRole === 'sales' ? 'sales' : null;
  const firstName = profile?.full_name?.split(' ')[0] || 'Olá';
  const isLoading = !isAuthenticated;

  // Determine experience based on org_role first
  let experience: InsightsExperience = 'sales';
  let title = 'Sales Coach AI';
  let subtitle = `${firstName}! Seu desenvolvimento personalizado`;

  if (orgRole === 'owner' || orgRole === 'admin') {
    experience = 'owner';
    title = 'Operations Intelligence Hub';
    subtitle = `${firstName}! Sua operação em tempo real`;
  } else if (orgRole === 'manager') {
    experience = 'manager';
    title = 'Team Coach Dashboard';
    subtitle = `${firstName}! Seu time precisa de você`;
  } else if (orgRole === 'finance') {
    experience = 'finance';
    title = 'Revenue Intelligence';
    subtitle = `${firstName}! Saúde financeira da operação`;
  } else if (orgRole === 'cs') {
    experience = 'cs';
    title = 'CS Performance Hub';
    subtitle = `${firstName}! Seus clientes esperam por você`;
  } else {
    // Default to sales for any other role
    experience = 'sales';
    title = 'Sales Coach AI';
    subtitle = `${firstName}! Seu desenvolvimento personalizado`;
  }

  return {
    experience,
    orgRole,
    sellerRole,
    isLoading,
    title,
    subtitle,
  };
}
