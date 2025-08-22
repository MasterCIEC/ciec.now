import React, { createContext, useState, useEffect, useContext, ReactNode, useRef, useCallback } from 'react';
import { AuthSession, User } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';
import { UserProfile } from '../types';

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
  const [loading, setLoading] = useState(true);
  const [showInactivityModal, setShowInactivityModal] = useState(false);
  const [awaitingPasswordReset, setAwaitingPasswordReset] = useState(false);
  const inactivityTimer = useRef<number | null>(null);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());

  // Función centralizada para refrescar todos los datos de la sesión del usuario.
  const refreshSessionData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error("Error fetching session:", sessionError);
        setSession(null); setUser(null); setProfile(null); setPermissions(new Set());
        return;
      }

      setSession(currentSession);
      const currentUser = currentSession?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        const { data: userProfileData, error: profileError } = await supabase
          .from('userprofiles')
          .select(`*, roles (id, name)`)
          .eq('id', currentUser.id)
          .single();

        if (profileError && profileError.code !== 'PGRST116') {
          console.error("Error fetching profile:", profileError);
          setProfile(null); setPermissions(new Set());
        } else {
          setProfile(userProfileData as UserProfile | null);
          if (userProfileData?.roles?.id) {
            const { data: rolePermissionsData, error: permissionsError } = await supabase
              .from('rolepermissions')
              .select('permissions(action, subject)')
              .eq('role_id', userProfileData.roles.id);

            if (permissionsError) {
              console.error("Error fetching permissions:", permissionsError);
              setPermissions(new Set());
            } else {
              const userPermissions = new Set(
                rolePermissionsData.map(p => `${p.permissions.action}:${p.permissions.subject}`)
              );
              setPermissions(userPermissions);
            }
          } else {
            setPermissions(new Set());
          }
        }
      } else {
        setProfile(null);
        setPermissions(new Set());
      }
    } catch (error) {
      console.error("A critical error occurred during session refresh:", error);
      setSession(null); setUser(null); setProfile(null); setPermissions(new Set());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Carga inicial de la sesión
    refreshSessionData();

    // Listener de Supabase para cambios de autenticación (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event) => {
      if (_event === 'SIGNED_IN' || _event === 'SIGNED_OUT') {
        refreshSessionData();
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [refreshSessionData]);
  
  // --- CORRECCIÓN APLICADA AQUÍ ---
  // Este efecto maneja el problema de la pestaña del navegador.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Cuando la pestaña vuelve a estar visible, forzamos un refresco completo de los datos.
        console.log("Tab is visible again, refreshing session data...");
        refreshSessionData();
      }
    };
    // Agregamos un listener para el evento 'visibilitychange'
    document.addEventListener('visibilitychange', handleVisibilityChange);
    // Limpiamos el listener cuando el componente se desmonta
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshSessionData]);

  const signOut = useCallback(async (options?: { dueToInactivity?: boolean }) => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    await supabase.auth.signOut();
    if (options?.dueToInactivity) setShowInactivityModal(true);
  }, []);

  const handleInactivity = useCallback(() => {
    signOut({ dueToInactivity: true });
  }, [signOut]);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = window.setTimeout(handleInactivity, INACTIVITY_TIMEOUT);
  }, [handleInactivity]);

  useEffect(() => {
    if (session) {
        const events: (keyof WindowEventMap)[] = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
        events.forEach(event => window.addEventListener(event, resetInactivityTimer, { passive: true }));
        resetInactivityTimer();
        return () => {
            events.forEach(event => window.removeEventListener(event, resetInactivityTimer));
            if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
        };
    } else {
        if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    }
  }, [session, resetInactivityTimer]);

  const closeInactivityModal = () => setShowInactivityModal(false);

  const can = useCallback((action: string, subject: string): boolean => {
    if (profile?.roles?.name === 'SuperAdmin') {
      return true;
    }
    return permissions.has(`${action}:${subject}`);
  }, [profile, permissions]);

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
