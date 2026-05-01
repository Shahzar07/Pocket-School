'use client';

import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuthSTORE } from '@/hooks/use-auth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setUser = useAuthSTORE((state) => state.setUser);
  const fetchProfile = useAuthSTORE((state) => state.fetchProfile);
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        await fetchProfile(user.uid);
      } else {
        useAuthSTORE.setState({ profile: null, loading: false });
      }
      // Assuming fetchProfile handles setting loading to false implicitly, let's just make sure
      useAuthSTORE.setState({ loading: false });
    });

    return () => unsubscribe();
  }, [setUser, fetchProfile]);

  return <>{children}</>;
}
