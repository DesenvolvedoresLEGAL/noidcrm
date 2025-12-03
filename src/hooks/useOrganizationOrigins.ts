import { useState, useEffect } from 'react';
import { listOrigins, listOriginGroups, type OriginWithGroup, type OriginGroup } from '@/services/supabase/origins';

export function useOrganizationOrigins() {
  const [origins, setOrigins] = useState<OriginWithGroup[]>([]);
  const [groups, setGroups] = useState<OriginGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchOrigins() {
      try {
        setLoading(true);
        const [originsData, groupsData] = await Promise.all([
          listOrigins(),
          listOriginGroups()
        ]);
        
        // Filter only active origins
        setOrigins(originsData.filter(o => o.is_active));
        setGroups(groupsData.filter(g => g.is_active));
      } catch (err) {
        setError(err as Error);
        console.error('Error fetching origins:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchOrigins();
  }, []);

  return { origins, groups, loading, error };
}
