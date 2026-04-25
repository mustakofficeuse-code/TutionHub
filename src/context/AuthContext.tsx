import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';

interface AuthContextType {
  user: User | null;
  profile: any | null;
  loading: boolean;
  role: 'teacher' | 'student' | 'admin' | null;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  role: null,
  refreshProfile: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<'teacher' | 'student' | 'admin' | null>(null);

  const fetchProfile = async (uid: string) => {
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setProfile({ ...data, uid });
        setRole(data.role);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.uid);
    }
  };

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;
    let unsubscribeBlacklist: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      // Cleanup previous listeners
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }
      if (unsubscribeBlacklist) {
        unsubscribeBlacklist();
        unsubscribeBlacklist = null;
      }

      if (currentUser) {
        const docRef = doc(db, 'users', currentUser.uid);
        
        // Listen to blacklist for this specific user
        const blacklistByEmail = currentUser.email ? doc(db, 'blacklist', currentUser.email) : null;
        const blacklistByUid = doc(db, 'blacklist', currentUser.uid);

        const checkBlock = (snap: any) => {
          if (snap.exists()) {
            console.log("User is blocked, signing out...");
            auth.signOut();
          }
        };

        if (blacklistByEmail) {
          const unsubEmail = onSnapshot(blacklistByEmail, checkBlock);
          const unsubUid = onSnapshot(blacklistByUid, checkBlock);
          unsubscribeBlacklist = () => {
            unsubEmail();
            unsubUid();
          };
        } else {
          unsubscribeBlacklist = onSnapshot(blacklistByUid, checkBlock);
        }

        unsubscribeProfile = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setProfile({ ...data, uid: currentUser.uid });
            setRole(data.role);
          } else {
            // Profile missing - let AuthGateway handle recovery
            setProfile(null);
            setRole(null);
          }
          setLoading(false);
        }, (error: any) => {
          if (error.code !== 'auth/invalid-credential' && !error.message?.includes('auth/invalid-credential')) {
            console.error("Error listening to profile:", error);
          }
          setLoading(false);
        });
      } else {
        setProfile(null);
        setRole(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeBlacklist) unsubscribeBlacklist();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, role, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
