import { useState, useEffect } from 'react';
import { listBusinessUnits, type BusinessUnit } from '@/services/crm/business-units';

export function useBusinessUnits() {
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchBusinessUnits() {
      try {
        setLoading(true);
        const data = await listBusinessUnits();
        setBusinessUnits(data);
      } catch (err) {
        setError(err as Error);
        console.error('Error fetching business units:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchBusinessUnits();
  }, []);

  const refetch = async () => {
    try {
      setLoading(true);
      const data = await listBusinessUnits();
      setBusinessUnits(data);
    } catch (err) {
      setError(err as Error);
      console.error('Error refetching business units:', err);
    } finally {
      setLoading(false);
    }
  };

  return { businessUnits, loading, error, refetch };
}
