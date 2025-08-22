import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback } from 'react';
import { AuthSession, User } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';
import { UserProfile, Permission } from '../types';

type AuthContextType = {
  session: AuthSession | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  awaitingPasswordReset: boolean;
  setAwaitingPasswordReset: React.Dispatch<React.SetStateAction<boolean>>;
  can: (action: string, subject: string) => boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }): JSX.Element => {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [awaitingPasswordReset, setAwaitingPasswordReset] = useState(false);
  const [permissions, setPermissions] = useState<Permission[]>([]);

  const fetchProfileAndPermissions = useCallback(async (user: User) => {
    // ... esta función no cambia ...
    try {
      if (!supabase) throw new Error("Supabase client not initialized");
      const { data: profileData, error: profileError } = await supabase
        .from('userprofiles')
        .select(`
          id,
          full_name,
          is_approved,
          role_id,
          roles (
            id,
            name
          )
        `)
        .eq('id', user.id)
        .single();
      
      if (profileError) throw profileError;
      if (profileData) {
        setProfile(profileData as any as UserProfile);
        
        if (profileData.role_id) {
          const { data: rolePermsData, error: rolePermsError } = await supabase
            .from('rolepermissions')
            .select('permission_id')
            .eq('role_id', profileData.role_id);
          if (rolePermsError) throw rolePermsError;
          
          if (rolePermsData && rolePermsData.length > 0) {
            const permissionIds = rolePermsData.map(rp => rp.permission_id);
            const { data: permsData, error: permsError } = await supabase
              .from('permissions')
              .select('*')
              .in('id', permissionIds);
            
            if (permsError) throw permsError;
            setPermissions((permsData as Permission[]) || []);
          } else {
            setPermissions([]);
          }
        } else {
          setPermissions([]);
        }
      }
    } catch (error) {
      console.error('Error fetching user profile or permissions:', error);
      setProfile(null);
      setPermissions([]);
      throw error;
    }
  }, []);

  useEffect(() => {
    const checkInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        try {
          await fetchProfileAndPermissions(session.user);
        } catch (e) {
          console.error("Error during initial session check:", e);
        }
      }
      setLoading(false);
    };

    checkInitialSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      // Lógica robusta para evitar recargas innecesarias
      const currentUser = user;
      const newUser = newSession?.user ?? null;

      // Solo activa la pantalla de carga si el usuario realmente cambia (login/logout)
      if (currentUser?.id !== newUser?.id) {
        setLoading(true);
        if (newUser) {
          await fetchProfileAndPermissions(newUser);
        } else {
          setProfile(null);
          setPermissions([]);
        }
        setLoading(false);
      }
      
      setSession(newSession);
      setUser(newUser);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []); // Dependencias vacías para que se ejecute solo una vez

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };
  
  const can = useCallback((action: string, subject: string) => {
      if (profile?.roles?.name === 'SuperAdmin') return true;
      const hasPermission = permissions.some(p => p.action === action && p.subject === subject);
      if (hasPermission) return true;
      const canManage = permissions.some(p => p.action === 'manage' && p.subject === subject);
      return canManage;
  }, [permissions, profile]);


  const value = {
    session,
    user,
    profile,
    loading,
    signOut,
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