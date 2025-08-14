import React, { createContext, useState, useEffect, useContext, ReactNode, useRef, useCallback } from 'react';
import { AuthSession, User } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';
import { UserProfile, Permission } from '../types';

type AuthContextType = {
  session: AuthSession | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: (options?: { dueToInactivity?: boolean }) => Promise<void>;
  showInactivityModal: boolean;
  closeInactivityModal: () => void;
  awaitingPasswordReset: boolean;
  setAwaitingPasswordReset: React.Dispatch<React.SetStateAction<boolean>>;
  can: (action: string, subject: string) => boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactivityModal, setShowInactivityModal] = useState(false);
  const [awaitingPasswordReset, setAwaitingPasswordReset] = useState(false);
  const inactivityTimer = useRef<number | null>(null);

  const can = useCallback((action: string, subject: string): boolean => {
    if (profile?.roles?.name === 'SuperAdmin') return true;
    return permissions.some(p => 
      (p.subject === subject && (p.action === action || p.action === 'manage'))
    );
  }, [permissions, profile]);


  useEffect(() => {
    setLoading(true);

    const fetchProfileAndPermissions = async (user: User | null) => {
      if (!user) {
        setProfile(null);
        setPermissions([]);
        return;
      }

      const { data: userProfileData, error: profileError } = await supabase
        .from('userprofiles')
        .select(`*, roles (id, name)`)
        .eq('id', user.id)
        .single();
      
      if (profileError && profileError.code !== 'PGRST116') {
        console.error("Error fetching profile:", profileError);
        setProfile(null);
        setPermissions([]);
        return;
      }
      
      const currentProfile = (userProfileData as any) as UserProfile | null;
      setProfile(currentProfile);

      if (currentProfile && currentProfile.role_id) {
        const { data: rolePermsData, error: rolePermsError } = await supabase
          .from('rolepermissions')
          .select('permission_id')
          .eq('role_id', currentProfile.role_id);
        
        if (rolePermsError) {
          console.error("Error fetching role permissions:", rolePermsError);
          setPermissions([]);
          return;
        }

        const permissionIds = rolePermsData.map(p => p.permission_id);
        if (permissionIds.length > 0) {
          const { data: permissionsData, error: permsError } = await supabase
            .from('permissions')
            .select('action, subject')
            .in('id', permissionIds);
          
          if (permsError) {
            console.error("Error fetching permissions:", permsError);
            setPermissions([]);
          } else {
            setPermissions((permissionsData as any) || []);
          }
        } else {
          setPermissions([]);
        }
      } else {
        setPermissions([]);
      }
    };
    
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      await fetchProfileAndPermissions(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setLoading(true);
      setSession(session);
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      if (_event === 'PASSWORD_RECOVERY') {
        setAwaitingPasswordReset(true);
      } else if (_event !== 'USER_UPDATED') {
        setAwaitingPasswordReset(false);
      }

      await fetchProfileAndPermissions(currentUser);
      setLoading(false);
    });

    return () => {
      subscription?.unsubscribe();
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
    awaitingPasswordReset,
    setAwaitingPasswordReset,
    can,
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