import { useEffect, useState } from 'react';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, User, Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FB_API_KEY || 'demo-key',
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN || 'demo.firebaseapp.com',
  projectId: import.meta.env.VITE_FB_PROJECT_ID || 'demo-project',
  appId: import.meta.env.VITE_FB_APP_ID || 'demo-app',
};

const MOCK_MODE = import.meta.env.VITE_MOCK_AUTH === 'true';

let app: FirebaseApp;
let auth: Auth;

// Mock user for demo mode
const MOCK_USER: Partial<User> = {
  uid: 'demo-user-1',
  email: 'demo@legal.com',
  displayName: 'Usuário Demo',
  emailVerified: true,
} as User;

export function useFirebaseAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock mode: return fake user immediately
    if (MOCK_MODE) {
      const mockUser = localStorage.getItem('mockAuthUser');
      setUser(mockUser ? (MOCK_USER as User) : null);
      setLoading(false);
      return;
    }

    // Real Firebase Auth
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }
    
    if (!auth) {
      auth = getAuth(app);
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { user, auth, loading, isMockMode: MOCK_MODE };
}
