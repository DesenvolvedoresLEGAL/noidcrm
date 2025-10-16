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

const MOCK_SENSITIVE_DATA: UserSensitiveData = {
  role: 'admin',
  escopos: ['all'],
  times: ['vendas', 'cs'],
  territorios: ['BR', 'LATAM'],
  preferencias: {
    theme: 'dark',
    notifications: true,
  }
};

export function useUserSensitive() {
  const { user, loading: authLoading, isMockMode } = useFirebaseAuth();
  const [sensitive, setSensitive] = useState<UserSensitiveData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      setSensitive(null);
      setLoading(false);
      return;
    }

    // Mock mode: return fixed data immediately
    if (isMockMode) {
      setSensitive(MOCK_SENSITIVE_DATA);
      setLoading(false);
      return;
    }

    // Real Firestore fetch
    const fetchSensitiveData = async () => {
      try {
        const db = getFirestore();
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        
        if (userDoc.exists()) {
          setSensitive(userDoc.data() as UserSensitiveData);
        } else {
          setSensitive(MOCK_SENSITIVE_DATA);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        setSensitive(MOCK_SENSITIVE_DATA);
      } finally {
        setLoading(false);
      }
    };

    fetchSensitiveData();
  }, [user, authLoading, isMockMode]);

  return { user, sensitive, loading: authLoading || loading };
}
