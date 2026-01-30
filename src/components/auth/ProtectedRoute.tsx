import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Check if user has a school_id in their profile
  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ["user-profile-school-check", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("school_id, role")
        .eq("id", user.id)
        .single();
      
      if (error) {
        console.error("Error fetching profile:", error);
        return null;
      }
      return data;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 30, // Cache for 30 seconds
  });

  if (loading || (user && profileLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-xl gradient-primary animate-pulse" />
          <p className="text-muted-foreground">טוען...</p>
        </div>
      </div>
    );
  }

  // Allow demo mode without authentication
  const isDemoMode = location.search.includes("demo=true");
  
  if (!user && !isDemoMode) {
    return <Navigate to="/auth" replace />;
  }

  // In demo mode without user, allow access
  if (!user && isDemoMode) {
    return <>{children}</>;
  }

  // If user has no school_id and is not on allowed pages, redirect to welcome
  const allowedPaths = ["/auth/setup-school", "/welcome"];
  const isOnAllowedPage = allowedPaths.includes(location.pathname);
  const hasSchool = profileData?.school_id !== null && profileData?.school_id !== undefined;

  if (!hasSchool && !isOnAllowedPage && !isDemoMode && profileData !== undefined) {
    // User logged in but has no school - redirect to welcome page
    return <Navigate to="/welcome" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
