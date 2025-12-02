import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { MeasurementUnit } from '@/services/crm/measurement-units';

export function useMeasurementUnits() {
  const [units, setUnits] = useState<MeasurementUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchUnits() {
      try {
        setLoading(true);
        const { data, error: fetchError } = await supabase
          .from('measurement_units')
          .select('*')
          .eq('is_active', true)
          .order('is_default', { ascending: false })
          .order('name');
        
        if (fetchError) throw fetchError;
        
        setUnits(data || []);
      } catch (err) {
        setError(err as Error);
        console.error('Error fetching measurement units:', err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchUnits();
  }, []);

  return { units, loading, error };
}
