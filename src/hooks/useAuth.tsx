import { useEffect, useState, createContext, useContext, ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "coach" | "customer";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: AppRole | null;
  isAdmin: boolean;
  isCoach: boolean;
  isCustomer: boolean;
  isStaff: boolean;
  isDemoMode: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AppRole | null>(null);
  const [searchParams] = useSearchParams();
  
  // Check if we're in demo mode via URL param
  const isDemoModeFromUrl = searchParams.get("demo") === "true";

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer role fetching to avoid deadlock
        if (session?.user) {
          setTimeout(() => {
            fetchUserRole(session.user.id);
          }, 0);
        } else {
          // In demo mode without auth, default to admin role
          if (isDemoModeFromUrl) {
            setRole("admin");
          } else {
            setRole(null);
          }
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserRole(session.user.id);
      } else {
        // In demo mode without auth, default to admin role
        if (isDemoModeFromUrl) {
          setRole("admin");
        }
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [isDemoModeFromUrl]);

  const fetchUserRole = async (userId: string) => {
    try {
      // Use direct query to user_roles table (RLS allows users to see their own role)
      const { data, error } = await supabase
        .from('user_roles' as any)
        .select('role')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error("Error fetching user role:", error);
        // Fallback to profiles table if user_roles doesn't have entry yet
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .single();
        
        if (profileError) {
          setRole("customer");
        } else {
          const profileRole = (profileData as any)?.role as AppRole;
          setRole(profileRole ?? "customer");
        }
      } else {
        const roleValue = (data as any)?.role as AppRole;
        setRole(roleValue ?? "customer");
      }
    } catch (error) {
      console.error("Error fetching user role:", error);
      setRole("customer");
    } finally {
      setLoading(false);
    }
  };

  // In demo mode, use simulated role from localStorage if available
  const getDemoRole = (): AppRole => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('demoRole');
      if (stored === 'admin' || stored === 'coach' || stored === 'customer') {
        return stored;
      }
    }
    return 'admin'; // Default to admin in demo mode
  };

  const effectiveRole = isDemoModeFromUrl && !user ? getDemoRole() : role;

  const value: AuthContextType = {
    user,
    session,
    loading,
    role: effectiveRole,
    isAdmin: effectiveRole === "admin",
    isCoach: effectiveRole === "coach",
    isCustomer: effectiveRole === "customer",
    isStaff: effectiveRole === "admin" || effectiveRole === "coach",
    isDemoMode: isDemoModeFromUrl,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
