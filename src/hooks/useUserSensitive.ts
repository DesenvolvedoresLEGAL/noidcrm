import { useEffect, useState } from 'react';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { useFirebaseAuth } from './useFirebaseAuth';

interface UserSensitiveData {
  role?: 'admin' | 'vendas' | 'cs' | 'gestao';
  escopos?: string[];
  times?: string[];
  territorios?: string[];
  preferencias?: Record<string, any>;
}

export function useUserSensitive() {
  const { user, loading: authLoading } = useFirebaseAuth();
  const [sensitive, setSensitive] = useState<UserSensitiveData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      setSensitive(null);
      setLoading(false);
      return;
    }

    const fetchSensitiveData = async () => {
      try {
        const db = getFirestore();
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        
        if (userDoc.exists()) {
          setSensitive(userDoc.data() as UserSensitiveData);
        } else {
          // Default data for demo
          setSensitive({
            role: 'admin',
            escopos: ['all'],
            times: ['vendas'],
            territorios: ['BR'],
            preferencias: {}
          });
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        setSensitive(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSensitiveData();
  }, [user, authLoading]);

  return { user, sensitive, loading: authLoading || loading };
}
