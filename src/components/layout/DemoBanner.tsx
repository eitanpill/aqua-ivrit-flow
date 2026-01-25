import { AlertTriangle, X, Building2 } from "lucide-react";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useDemoMode } from "@/hooks/useDemoMode";

export function DemoBanner() {
  const { isDemoMode } = useDemoMode();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(true);

  // Show banner for actual demo mode OR demo query param
  const isViewingDemo = isDemoMode || searchParams.get("demo") === "true";

  if (!isViewingDemo || !isVisible) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2.5 text-center relative">
      <div className="flex items-center justify-center gap-3 text-sm font-medium flex-wrap">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          <span>מצב הדגמה - הנתונים הם להמחשה בלבד</span>
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="h-7 text-xs bg-white/20 hover:bg-white/30 text-white border-white/30"
          onClick={() => navigate("/welcome")}
        >
          <Building2 className="h-3 w-3 ml-1" />
          הקם את בית הספר שלי
        </Button>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="absolute left-2 top-1/2 -translate-y-1/2 h-6 w-6 text-white/80 hover:text-white hover:bg-white/10"
        onClick={() => setIsVisible(false)}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
