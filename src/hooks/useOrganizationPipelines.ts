import { useState, useEffect } from 'react';
import { listPipelines, type Pipeline } from '@/services/crm/pipelines';

export function useOrganizationPipelines() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchPipelines() {
      try {
        setLoading(true);
        const data = await listPipelines();
        setPipelines(data);
      } catch (err) {
        setError(err as Error);
        console.error('Error fetching pipelines:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchPipelines();
  }, []);

  return { pipelines, loading, error };
}
