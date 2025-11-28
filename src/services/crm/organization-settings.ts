import { supabase } from '@/integrations/supabase/client';

export interface ProposalSettings {
  default_currency: 'BRL' | 'USD' | 'EUR';
  proposal_prefix: string;
  proposal_sequence: number;
  proposal_validity_days: number;
}

/**
 * Get proposal settings for an organization
 */
export const getProposalSettings = async (organizationId: string): Promise<ProposalSettings | null> => {
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('default_currency, proposal_prefix, proposal_sequence, proposal_validity_days')
      .eq('id', organizationId)
      .single();

    if (error) throw error;
    return data as ProposalSettings;
  } catch (error) {
    console.error('Error fetching proposal settings:', error);
    return null;
  }
};

/**
 * Update proposal settings for an organization
 */
export const updateProposalSettings = async (
  organizationId: string,
  settings: Partial<ProposalSettings>
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('organizations')
      .update(settings)
      .eq('id', organizationId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating proposal settings:', error);
    throw error;
  }
};

/**
 * Format currency value based on currency code
 */
export const formatCurrencyValue = (value: number, currency: string): string => {
  const formatters: Record<string, Intl.NumberFormat> = {
    BRL: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }),
    USD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
    EUR: new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }),
  };

  const formatter = formatters[currency] || formatters.BRL;
  return formatter.format(value);
};

/**
 * Get currency symbol
 */
export const getCurrencySymbol = (currency: string): string => {
  const symbols: Record<string, string> = {
    BRL: 'R$',
    USD: '$',
    EUR: '€',
  };
  return symbols[currency] || 'R$';
};
