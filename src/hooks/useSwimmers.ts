import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";

type UseSwimmersOptions = {
  /** When provided, returns only swimmers belonging to this parent (customer scope) */
  parentId?: string;
  /** Additional enable flag (still requires currentSchool.id) */
  enabled?: boolean;
};

/**
 * Strict multi-tenancy: ALWAYS scopes swimmers by the active school.
 */
export function useSwimmers(options: UseSwimmersOptions = {}) {
  const { currentSchool } = useSchool();
  const schoolId = currentSchool?.id ?? null;

  return useQuery({
    queryKey: ["swimmers", schoolId, options.parentId ?? null],
    queryFn: async () => {
      console.log("Fetching data for School ID:", schoolId);

      if (!schoolId) return [];

      let query = supabase
        .from("swimmers")
        .select("*")
        .eq("school_id", schoolId);

      if (options.parentId) {
        query = query.eq("parent_id", options.parentId);
      }

      const { data, error } = await query.order("first_name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: (options.enabled ?? true) && !!schoolId,
  });
}
