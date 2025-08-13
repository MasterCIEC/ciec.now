import React, { createContext, useState, useEffect, useContext, ReactNode, useRef, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';
import { UserProfile } from '../types';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: (options?: { dueToInactivity?: boolean }) => Promise<void>;
  showInactivityModal: boolean;
  closeInactivityModal: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInactivityModal, setShowInactivityModal] = useState(false);
  const inactivityTimer = useRef<number | null>(null);

  useEffect(() => {
    setLoading(true);
    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        // Fetch profile first, then role, to avoid issues with relational queries and missing type definitions.
        const { data: userProfileData, error: profileError } = await supabase
          .from('userprofiles')
          .select('*')
          .eq('id', currentUser.id)
          .single();
        
        if (profileError && profileError.code !== 'PGRST116') {
          console.error("Error fetching profile on auth state change:", profileError);
          setProfile(null);
        } else if (userProfileData) {
          let finalProfile: UserProfile = userProfileData as UserProfile;
          if (userProfileData.role_id) {
            const { data: roleData, error: roleError } = await supabase
              .from('roles')
              .select('id, name')
              .eq('id', userProfileData.role_id)
              .single();
            
            if (!roleError && roleData) {
              finalProfile.roles = roleData;
            }
          }
          setProfile(finalProfile);
        } else {
            setProfile(null);
        }
      } else {
        setProfile(null);
      }
      
      setLoading(false);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async (options?: { dueToInactivity?: boolean }) => {
    if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
    }
    await supabase.auth.signOut();
    if (options?.dueToInactivity) {
        setShowInactivityModal(true);
    }
  }, []);

  const handleInactivity = useCallback(() => {
    signOut({ dueToInactivity: true });
  }, [signOut]);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
    }
    inactivityTimer.current = window.setTimeout(handleInactivity, INACTIVITY_TIMEOUT);
  }, [handleInactivity]);

  useEffect(() => {
    if (session) {
        const events: (keyof WindowEventMap)[] = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
        
        events.forEach(event => window.addEventListener(event, resetInactivityTimer, { passive: true }));
        resetInactivityTimer();

        return () => {
            events.forEach(event => window.removeEventListener(event, resetInactivityTimer));
            if (inactivityTimer.current) {
                clearTimeout(inactivityTimer.current);
            }
        };
    } else {
        if (inactivityTimer.current) {
            clearTimeout(inactivityTimer.current);
        }
    }
  }, [session, resetInactivityTimer]);

  const closeInactivityModal = () => setShowInactivityModal(false);

  const value = {
    session,
    user,
    profile,
    loading,
    signOut,
    showInactivityModal,
    closeInactivityModal,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
