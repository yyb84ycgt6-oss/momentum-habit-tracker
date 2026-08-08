/**
 * Auth context — the PC's `useAuth()`, backed by Supabase.
 *
 * PC's version wrapped Firebase Auth. The ported apps only ever read
 * `user`, `loading` and `isAuthenticated`, so the contract is kept exactly
 * and only the provider underneath changed. That is the whole reason those
 * apps compile here unmodified.
 *
 * One deliberate difference: PC's `useAuth()` threw when called outside a
 * provider. Here it degrades to a signed-out value instead. Apps open in
 * windows, and a missing provider should not turn an app into a blank frame
 * — the window error boundary exists for real bugs, not wiring accidents.
 */
import React, { createContext, useContext, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
}

const SIGNED_OUT: AuthContextType = { user: null, loading: false, isAuthenticated: false };

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Subscribe before the initial read so a sign-in landing between the two
    // is not missed.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => useContext(AuthContext) ?? SIGNED_OUT;
