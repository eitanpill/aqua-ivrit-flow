import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Gift } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";

interface MakeUpTokensBannerProps {
  swimmerId: string;
}

interface MakeUpToken {
  id: string;
  swimmer_id: string;
  expiry_date: string;
  reason: string | null;
  used_at: string | null;
}

export function MakeUpTokensBanner({ swimmerId }: MakeUpTokensBannerProps) {
  const { data: tokens = [] } = useQuery({
    queryKey: ["make-up-tokens", swimmerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("make_up_tokens" as any)
        .select("*")
        .eq("swimmer_id", swimmerId)
        .is("used_at", null)
        .gte("expiry_date", new Date().toISOString().split("T")[0])
        .order("expiry_date") as any;

      if (error) throw error;
      return (data || []) as MakeUpToken[];
    },
    enabled: !!swimmerId,
  });

  if (tokens.length === 0) return null;

  const nearestExpiry = tokens[0]?.expiry_date;

  return (
    <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-lg p-4 flex items-center gap-3">
      <div className="rounded-full bg-amber-500/20 p-2">
        <Gift className="h-5 w-5 text-amber-600" />
      </div>
      <div className="flex-1">
        <p className="font-medium text-amber-800 dark:text-amber-200">
          לרשותך {tokens.length} שיעורי השלמה
        </p>
        <p className="text-sm text-amber-700/80 dark:text-amber-300/80">
          תוקף עד {format(new Date(nearestExpiry), "dd/MM/yyyy", { locale: he })}
        </p>
      </div>
    </div>
  );
}
