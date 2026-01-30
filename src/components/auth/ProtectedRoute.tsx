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

  // Check if user has a school_id in their profile and subscription status
  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ["user-profile-school-check", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("school_id, role, subscription_paid")
        .eq("id", user.id)
        .single();
      
      if (error) {
        console.error("Error fetching profile:", error);
        return null;
      }
      return data;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 10, // Cache for 10 seconds (shorter to detect payment faster)
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

  // If user has no school_id and is not on allowed pages, redirect appropriately
  const allowedPaths = ["/auth/setup-school", "/welcome", "/auth/subscription"];
  const isOnAllowedPage = allowedPaths.includes(location.pathname);
  const hasSchool = profileData?.school_id !== null && profileData?.school_id !== undefined;
  const hasPaidSubscription = profileData?.subscription_paid === true;

  if (!hasSchool && !isOnAllowedPage && !isDemoMode && profileData !== undefined) {
    // User logged in but has no school
    if (hasPaidSubscription) {
      // User paid but hasn't created school yet - send to setup
      return <Navigate to="/auth/setup-school" replace state={{ from: location }} />;
    } else {
      // User hasn't paid - redirect to welcome/subscription flow
      return <Navigate to="/welcome" replace state={{ from: location }} />;
    }
  }

  return <>{children}</>;
}
