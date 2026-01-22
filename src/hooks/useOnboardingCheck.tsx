import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";

export function useOnboardingCheck() {
  const { isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [shouldCheck, setShouldCheck] = useState(true);

  // Check if locations exist
  const { data: hasLocations, isLoading: locationsLoading } = useQuery({
    queryKey: ["onboarding-check-locations"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("locations")
        .select("*", { count: "exact", head: true });

      if (error) throw error;
      return (count || 0) > 0;
    },
    enabled: isAdmin && shouldCheck,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  useEffect(() => {
    // Don't redirect if already on onboarding page
    if (location.pathname === "/onboarding") {
      setShouldCheck(false);
      return;
    }

    // Wait for auth and locations query to complete
    if (authLoading || locationsLoading) return;

    // Only redirect admins with no locations to onboarding
    if (isAdmin && hasLocations === false) {
      navigate("/onboarding", { replace: true });
    }
  }, [isAdmin, hasLocations, authLoading, locationsLoading, navigate, location.pathname]);

  return {
    isChecking: authLoading || locationsLoading,
    needsOnboarding: isAdmin && hasLocations === false,
  };
}
